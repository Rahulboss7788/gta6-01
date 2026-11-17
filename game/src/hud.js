// Solmar Bay HUD: cash, health, wanted stars, the clock, the mission objective,
// a live minimap of the whole city, speed, toasts and banners — plus the start,
// pause and busted screens. All DOM, layered over the 3D canvas.
import { CITY, formatCash, formatClock } from './config.js';
import { currentObjective, currentTarget } from './missions.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud(callbacks) {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = null;
  let bannerTimer = null;

  function show(id, visible) {
    const node = el(id);
    if (node) node.style.display = visible ? 'flex' : 'none';
  }

  function showScreen(name) {
    show('menu', name === 'title');
    show('pause', name === 'pause');
    show('end', name === 'end');
    el('hud').style.display = name === 'play' ? 'block' : 'none';
    el('crosshair').style.display = name === 'play' ? 'block' : 'none';
  }

  function toast(message, kind) {
    const node = el('message');
    node.textContent = message;
    node.className = 'show ' + (kind || 'info');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { node.className = ''; }, 3600);
  }

  function banner(title, sub) {
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub || '';
    el('banner').className = 'show';
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { el('banner').className = ''; }, 3400);
  }

  function flashDamage() {
    const node = el('damage');
    node.style.opacity = '0.55';
    window.setTimeout(() => { node.style.opacity = '0'; }, 180);
  }

  // Buttons.
  el('btn-new').addEventListener('click', () => callbacks.onStart(true));
  el('btn-continue').addEventListener('click', () => callbacks.onStart(false));
  el('btn-resume').addEventListener('click', () => callbacks.onResume());
  el('btn-save').addEventListener('click', () => { callbacks.onSave(); toast('Game saved.', 'good'); });
  el('btn-restart').addEventListener('click', () => callbacks.onRestart());
  el('btn-mute').addEventListener('click', () => callbacks.onMute());
  el('btn-respawn').addEventListener('click', () => callbacks.onRespawn());

  return {
    showScreen,
    toast,
    banner,
    flashDamage,
    setEnd(title, sub) {
      el('end-title').textContent = title;
      el('end-sub').textContent = sub;
      showScreen('end');
    },
    setContinueVisible(visible, info) {
      el('btn-continue').style.display = visible ? 'inline-block' : 'none';
      el('menu-save-info').textContent = info || '';
    },
    setMuted(muted) {
      el('btn-mute').textContent = muted ? 'Sound: Off (M)' : 'Sound: On (M)';
    },
    update(ctx, dt) {
      const { state, player, missions, taxi, city } = ctx;
      el('cash').textContent = formatCash(state.cash);
      el('health-fill').style.width = Math.max(0, player.health) + '%';
      el('health-fill').style.background = player.health > 50 ? '#7ac98a' : player.health > 25 ? '#e8c33a' : '#e5534b';
      el('clock').textContent = formatClock(state.minutes);
      // Wanted stars, filled gold for the heat, empty for the rest.
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
      const starNode = el('stars');
      starNode.textContent = stars;
      starNode.style.color = state.wanted > 0 ? '#ffc23a' : 'rgba(255,255,255,0.45)';
      el('objective').textContent = currentObjective(missions);
      const target = currentTarget(missions, city.locations);
      const pos = player.onFoot ? { x: player.x, z: player.z } : { x: player.car.x, z: player.car.z };
      el('objective-dist').textContent = target
        ? Math.round(Math.hypot(target.x - pos.x, target.z - pos.z)) + 'm'
        : '';
      // Speed and taxi fare.
      if (!player.onFoot && player.car) {
        el('speed').textContent = Math.round(Math.abs(player.car.speed) * 2.4) + ' mph';
        el('car-name').textContent = player.carName + '  ·  ' + Math.round(player.car.health) + '%';
      } else {
        el('speed').textContent = '';
        el('car-name').textContent = 'On foot — press E near a car to drive it';
      }
      el('taxi-info').textContent = taxi.active
        ? `TAXI FARE → ${taxi.destName} · ${Math.ceil(taxi.timer)}s`
        : '';
      el('mission-timer').textContent = missions.timer > 0
        ? '⏱ ' + Math.ceil(missions.timer) + 's'
        : '';
      drawMinimap(mctx, ctx, pos, target);
    },
  };
}

// The minimap: the whole city on a 200px canvas — roads, water, park, the
// mission marker, police, fares and Dario's arrow, pointing where he faces.
function drawMinimap(g, ctx, pos, target) {
  const W = 200;
  const H = 200;
  const scale = W / 440;
  const toX = (x) => (x + 220) * scale;
  const toY = (z) => (z + 210) * scale;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(20, 24, 32, 0.88)';
  g.fillRect(0, 0, W, H);
  // Water at the bottom (south).
  g.fillStyle = '#2a7fa8';
  g.fillRect(0, toY(196), W, H - toY(196));
  // Beach.
  g.fillStyle = '#e8cf9a';
  g.fillRect(0, toY(172), W, toY(196) - toY(172));
  // Roads.
  g.strokeStyle = '#5a6068';
  g.lineWidth = 5;
  for (const s of CITY.streets) {
    g.beginPath();
    g.moveTo(toX(-200), toY(s));
    g.lineTo(toX(200), toY(s));
    g.stroke();
    g.beginPath();
    g.moveTo(toX(s), toY(-200));
    g.lineTo(toX(s), toY(210));
    g.stroke();
  }
  // Park.
  g.fillStyle = '#5a8c4a';
  g.beginPath();
  g.arc(toX(-20), toY(-20), 7, 0, Math.PI * 2);
  g.fill();
  // Sun coins.
  g.fillStyle = '#ffc23a';
  for (const c of ctx.coins) {
    if (c.taken) continue;
    g.fillRect(toX(c.x) - 1, toY(c.z) - 1, 2, 2);
  }
  // Police, red dots.
  g.fillStyle = '#ff4444';
  for (const car of ctx.police.cars) {
    g.beginPath();
    g.arc(toX(car.x), toY(car.z), 3, 0, Math.PI * 2);
    g.fill();
  }
  // Taxi fare destination, yellow square.
  if (ctx.taxi.active) {
    g.fillStyle = '#e8c33a';
    g.fillRect(toX(ctx.taxi.dest.x) - 3, toY(ctx.taxi.dest.z) - 3, 6, 6);
  }
  // Mission marker: a pulsing gold diamond.
  if (target) {
    const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
    g.fillStyle = '#ffc23a';
    g.beginPath();
    g.moveTo(toX(target.x), toY(target.z) - pulse);
    g.lineTo(toX(target.x) + pulse, toY(target.z));
    g.lineTo(toX(target.x), toY(target.z) + pulse);
    g.lineTo(toX(target.x) - pulse, toY(target.z));
    g.closePath();
    g.fill();
  }
  // Dario: a white arrow pointing where he (or his car) faces.
  const heading = ctx.player.onFoot ? ctx.player.heading : ctx.player.car.heading;
  g.save();
  g.translate(toX(pos.x), toY(pos.z));
  g.rotate(heading);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(0, -6);
  g.lineTo(4.5, 5);
  g.lineTo(-4.5, 5);
  g.closePath();
  g.fill();
  g.restore();
}
