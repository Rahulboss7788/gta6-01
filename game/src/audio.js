// Solmar Bay sound: everything is synthesised live with the Web Audio API —
// engine hum, sirens, gunshots, chimes and a small golden-hour music loop.
// No audio files are shipped, so the game loads nothing over the network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two-tone square wave, quiet until wanted.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  // A lazy sunset groove: Am – F – C – G bass notes with a plucked arpeggio.
  function startMusic() {
    if (musicTimer || !ctx) return;
    const chords = [
      [110, 220, 261.6, 329.6],
      [87.3, 174.6, 220, 261.6],
      [130.8, 196, 261.6, 329.6],
      [98, 196, 246.9, 293.7],
    ];
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const chord = chords[Math.floor(musicStep / 4) % 4];
      const note = chord[musicStep % 4];
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.55);
      if (musicStep % 4 === 0) {
        const bass = ctx.createOscillator();
        bass.type = 'sine';
        bass.frequency.value = chord[0];
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        bass.connect(bg);
        bg.connect(master);
        bass.start(t);
        bass.stop(t + 1.5);
      }
      musicStep += 1;
    }, 320);
  }

  function burst(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    setEngine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      const target = driving ? 0.03 + speed01 * 0.07 : 0.012;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(46 + speed01 * 110, ctx.currentTime, 0.08);
    },
    setSiren(on, time) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.028 : 0, ctx.currentTime, 0.2);
      sirenOsc.frequency.setTargetAtTime(on ? (Math.sin(time * 5) > 0 ? 720 : 540) : 700, ctx.currentTime, 0.05);
    },
    gunshot() { noise(0.14, 0.5, 1800); burst(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { burst(660, 0.12, 'sine', 0.25, 990); },
    coin() { burst(880, 0.1, 'sine', 0.2, 1320); window.setTimeout(() => burst(1320, 0.14, 'sine', 0.2, 1760), 90); },
    crash() { noise(0.3, 0.5, 700); },
    horn() { burst(370, 0.25, 'square', 0.12, 370); burst(466, 0.25, 'square', 0.1, 466); },
    missionJingle() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => burst(f, 0.22, 'triangle', 0.22), i * 110));
    },
    busted() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => burst(f, 0.3, 'sawtooth', 0.15), i * 160)); },
  };
}
