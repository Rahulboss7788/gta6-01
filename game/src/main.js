// Solmar Bay boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between four screens: title, play, paused and busted/wasted.
//
// ?seed=N fixes the city. ?shot=cover|drive|chase|mission stages that scene
// instead of the title screen, runs it forward, and sets window.__shotReady.
import { CITY, TUNING, MONEY_START, STEP } from './config.js';
import { buildCity, resolveCircleCollision } from './city.js';
import { createAudio } from './audio.js';
import {
  ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_TAXI, createInput,
} from './input.js';
import { createPlayer, tryEnterExitCar, updateCamera, updatePlayerOnFoot } from './player.js';
import { carDisplayName, createTraffic, nearestCarTo, updatePlayerCar, updateTraffic } from './vehicles.js';
import { createPedestrians, scarePedestrians, updatePedestrians } from './pedestrians.js';
import { clearPolice, createPolice, raiseWanted, updatePolice } from './police.js';
import { addBurst, createCombat, punch, shootPistol, updateCombatFx, updateEnemies } from './combat.js';
import {
  createCoins, createMissions, createTaxi, currentTarget, tryStartTaxi, updateCoins,
  updateMissions, updateTaxi,
} from './missions.js';
import { createHud } from './hud.js';
import { clearSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function announce(message) {
  status.textContent = message;
}

if (typeof THREE === 'undefined') {
  announce('Solmar Bay could not load its 3D engine. Please reload the page.');
  throw new Error('THREE failed to load');
}

// --- World ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffb36b);
scene.fog = new THREE.Fog(0xffc98a, 200, 560);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 20, 40);

// Golden-hour sun: low, warm, long shadows across the avenues.
const sun = new THREE.DirectionalLight(0xffd9a0, 1.35);
sun.position.set(160, 140, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
sun.shadow.camera.far = 700;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffd9b0, 0x5a6b7a, 0.75));

const city = buildCity(scene, seed);
const audio = createAudio();
const input = createInput(canvas);
const player = createPlayer(scene, city.locations.spawn.x, city.locations.spawn.z);
const traffic = createTraffic(scene, seed + 7);
const peds = createPedestrians(scene, 26, seed + 13);
const police = createPolice(scene);
const combat = createCombat(scene);
const missions = createMissions();
const coins = createCoins(scene, seed + 21);
const taxi = createTaxi();

const state = {
  cash: MONEY_START,
  wanted: 0,
  minutes: 18 * 60 + 30,
  coinsCollected: 0,
  shotsFired: 0,
  screen: 'title',
  lastDamageAt: -99,
  lastShotWantedAt: -99,
  elapsed: 0,
};

const ctx = {
  scene, camera, player, traffic, peds, police, combat, missions, coins, taxi, city, state, audio,
  hud: null,
  shotDrive: false,
  raiseWanted(n) { raiseWanted(state, n, ctx.hud); },
  saveGame() { saveGame(state, player, missions); },
  onBusted() { endRun('BUSTED', 'The Solmar Bay PD caught up with you. You lose 20% of your cash — but the city is still out there.'); },
  onWasted() { endRun('WASTED', 'Dario wakes up at Solmar General, $lighter and twice as angry. The bay is still his to take.'); },
};

// --- HUD and screens -------------------------------------------------------
const hud = createHud({
  onStart(newGame) {
    audio.unlock();
    if (newGame) {
      clearSave();
      resetRun();
    } else {
      applySave(loadSave());
    }
    state.screen = 'play';
    hud.showScreen('play');
    announce('Playing Solmar Bay. Mission: ' + (missions.done ? 'free roam' : 'follow the gold marker.'));
  },
  onResume() {
    state.screen = 'play';
    hud.showScreen('play');
  },
  onSave() { saveGame(state, player, missions); },
  onRestart() {
    clearSave();
    window.location.reload();
  },
  onMute() {
    audio.setMuted(!audio.isMuted());
    hud.setMuted(audio.isMuted());
  },
  onRespawn() {
    player.health = TUNING.playerMaxHealth;
    player.x = city.locations.hospital.x;
    player.z = city.locations.hospital.z - 6;
    player.y = 0;
    player.group.position.set(player.x, 0, player.z);
    player.group.visible = true;
    player.onFoot = true;
    player.car = null;
    state.wanted = 0;
    clearPolice(police, scene);
    state.screen = 'play';
    hud.showScreen('play');
    hud.toast('Back on the streets. Mara is waiting at the garage.', 'info');
  },
});
ctx.hud = hud;

function resetRun() {
  state.cash = MONEY_START;
  state.wanted = 0;
  state.coinsCollected = 0;
  state.shotsFired = 0;
  state.minutes = 18 * 60 + 30;
  missions.index = 0;
  missions.step = 0;
  missions.done = false;
  missions.stepStarted = false;
  missions.guardsSpawned = false;
  player.health = TUNING.playerMaxHealth;
  player.x = city.locations.spawn.x;
  player.z = city.locations.spawn.z;
  player.y = 0;
  player.onFoot = true;
  player.car = null;
  player.group.visible = true;
  player.group.position.set(player.x, 0, player.z);
  clearPolice(police, scene);
}

function applySave(save) {
  resetRun();
  if (!save) return;
  state.cash = save.cash;
  state.coinsCollected = save.coinsCollected || 0;
  state.shotsFired = save.shotsFired || 0;
  missions.index = Math.min(save.missionIndex, 4);
  state.minutes = save.time || state.minutes;
  player.x = save.x;
  player.z = save.z;
  player.group.position.set(player.x, 0, player.z);
}

function endRun(title, sub) {
  if (state.screen !== 'play') return;
  state.cash = Math.floor(state.cash * 0.8);
  state.wanted = 0;
  state.screen = 'end';
  audio.busted();
  audio.setEngine(0, false);
  audio.setSiren(false, 0);
  clearPolice(police, scene);
  hud.setEnd(title, sub);
  announce(title + '. ' + sub);
}

const saved = loadSave();
if (saved) {
  hud.setContinueVisible(true, `Save found: ${'$' + saved.cash} · mission ${Math.min(saved.missionIndex + 1, 5)}/5 · ${new Date(saved.savedAt).toLocaleDateString()}`);
}

// --- The step ---------------------------------------------------------------
const driveShim = {
  moveAxes: () => ({ fwd: 1, strafe: 0 }),
  key: () => false,
};

function stepWorld(dt) {
  // One-shot actions are handled even while paused, so P/Esc always resumes.
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (state.screen === 'play') {
      state.screen = 'pause';
      hud.showScreen('pause');
    } else if (state.screen === 'pause') {
      state.screen = 'play';
      hud.showScreen('play');
    }
  }
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    hud.setMuted(audio.isMuted());
  }
  if (state.screen !== 'play') return;

  state.elapsed += dt;
  state.minutes = (state.minutes + dt * 1.5) % (24 * 60);
  combat.cooldown = Math.max(0, combat.cooldown - dt);

  if (actions & ACTION_ENTER_CAR) {
    const nearest = nearestCarTo(traffic.cars, player.x, player.z, 6.5);
    const msg = tryEnterExitCar(player, { nearest, name: nearest ? carDisplayName(nearest) : '' }, state, audio, () => {
      ctx.raiseWanted(1);
      hud.toast('That car is stolen now — the owner called it in. Wanted level 1.', 'bad');
    });
    if (msg) hud.toast(msg, 'info');
  }
  if (actions & ACTION_PUNCH) punch(ctx);
  if (actions & ACTION_TAXI) tryStartTaxi(taxi, ctx);
  if (input.takeShoot() || input.shootHeld()) {
    const hit = shootPistol(ctx);
    void hit;
    if (state.elapsed - state.lastShotWantedAt > 8) {
      state.lastShotWantedAt = state.elapsed;
      ctx.raiseWanted(1);
    }
  }

  // Movement: on foot, or behind the wheel.
  if (player.onFoot) {
    updatePlayerOnFoot(player, input, dt, city.colliders, audio);
  } else if (player.car) {
    updatePlayerCar(player.car, ctx.shotDrive ? driveShim : input, dt, city.colliders, audio);
    // Collide with traffic: nudge apart, both slow down.
    for (const other of traffic.cars) {
      const dx = player.car.x - other.x;
      const dz = player.car.z - other.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.6 && d > 0.01) {
        player.car.x = other.x + (dx / d) * 4.6;
        player.car.z = other.z + (dz / d) * 4.6;
        player.car.speed *= 0.92;
        other.speed *= 0.7;
      }
    }
    // Running over a pedestrian is a crime, and the crowd knows it.
    for (const p of [...peds]) {
      if (Math.abs(player.car.speed) > 5 && Math.hypot(p.x - player.car.x, p.z - player.car.z) < 2.4) {
        scene.remove(p.mesh);
        peds.splice(peds.indexOf(p), 1);
        addBurst(combat, scene, p.x, 1, p.z, 0xff5533, 12);
        scarePedestrians(peds, p.x, p.z, 40);
        ctx.raiseWanted(1);
        window.setTimeout(() => {
          const fresh = createPedestrians(scene, 1, (Math.random() * 1e9) | 0);
          peds.push(...fresh);
        }, 8000);
      }
    }
    // A wrecked car strands Dario on foot.
    if (player.car.health <= 0) {
      addBurst(combat, scene, player.car.x, 1.5, player.car.z, 0xff8833, 26);
      addBurst(combat, scene, player.car.x, 2, player.car.z, 0x555555, 20);
      audio.crash();
      scene.remove(player.car.group);
      player.car = null;
      player.onFoot = true;
      player.group.visible = true;
      player.group.position.set(player.x, 0, player.z);
      ctx.raiseWanted(1);
      hud.toast('Your car is wrecked! On foot again — find another ride.', 'bad');
    }
  }

  updateTraffic(traffic, dt);
  updatePedestrians(peds, dt, player, city.colliders);
  updatePolice(police, ctx, dt);
  updateMissions(missions, ctx, dt);
  updateCoins(coins, ctx, dt);
  updateTaxi(taxi, ctx, dt);
  updateEnemies(combat, ctx, dt);
  updateCombatFx(combat, scene, dt);

  // Health creeps back when Dario has been out of trouble for a while.
  if (state.elapsed - state.lastDamageAt > 6 && player.health > 0 && player.health < TUNING.playerMaxHealth) {
    player.health = Math.min(TUNING.playerMaxHealth, player.health + 3 * dt);
  }
  if (player.health <= 0) {
    player.health = 0;
    ctx.onWasted();
  }

  // The mission beacon follows the current objective; the lighthouse beam sweeps.
  const target = currentTarget(missions, city.locations) || (taxi.active ? taxi.dest : null);
  city.beacon.visible = !!target;
  city.diamond.visible = !!target;
  if (target) {
    city.beacon.position.set(target.x, 30, target.z);
    city.diamond.position.set(target.x, 9 + Math.sin(state.elapsed * 2) * 0.6, target.z);
    city.diamond.rotation.y = state.elapsed * 1.5;
  }
  city.beam.rotation.y = state.elapsed * 0.4;
}

// --- The loop ---------------------------------------------------------------
let accumulator = 0;
let last = performance.now();
let framesRendered = 0;
let shotWarmedUp = false;

if (shot) {
  ctx.shotDrive = true;
  stageShot(shot, ctx);
  state.screen = 'play';
  hud.showScreen('play');
  // Run the world forward briefly so traffic, guards and crates are already
  // in place — short enough that staged police cars stay in frame.
  for (let i = 0; i < 36; i++) stepWorld(STEP);
  shotWarmedUp = true;
  announce('Solmar Bay screenshot scene: ' + shot);
} else {
  hud.showScreen('title');
  announce('Solmar Bay. Press Enter or click New Game to start.');
}

function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min((now - last) / 1000, 0.25);
  last = now;
  accumulator += frameDt;
  let guard = 0;
  while (accumulator >= STEP && guard < 8) {
    if (state.screen === 'play' || state.screen === 'pause') stepWorld(STEP);
    accumulator -= STEP;
    guard += 1;
  }
  if (state.screen === 'title') {
    // The title screen slowly orbits the city so it never sits on a still frame.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 120, 55, Math.cos(t * 0.05) * 120);
    camera.lookAt(0, 0, 0);
  } else {
    updateCamera(player, camera, frameDt);
  }
  hud.update(ctx, frameDt);
  renderer.render(scene, camera);
  framesRendered += 1;
  if (shot && shotWarmedUp && framesRendered >= 3) {
    window.__shotReady = true;
  }
  // Debug / play-test state, read by the screenshot and smoke-test tools.
  // Reports the car when driving, since the on-foot coordinates freeze then.
  const reportPos = player.onFoot ? { x: player.x, z: player.z } : { x: player.car.x, z: player.car.z };
  window.__solmar = {
    screen: state.screen,
    cash: Math.floor(state.cash),
    wanted: state.wanted,
    mission: missions.done ? 'done' : (missions.index + 1) + '.' + (missions.step + 1),
    inCar: !player.onFoot,
    health: Math.round(player.health),
    carHealth: player.car ? Math.round(player.car.health) : null,
    playerX: Math.round(reportPos.x * 10) / 10,
    playerZ: Math.round(reportPos.z * 10) / 10,
    enemiesAlive: combat.enemies.filter((e) => !e.dead).length,
    coinsLeft: coins.filter((c) => !c.taken).length,
    policeCars: police.cars.length,
    traffic: traffic.cars.length,
    peds: peds.length,
    framesRendered,
  };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play' && !shot) {
    state.screen = 'pause';
    hud.showScreen('pause');
  }
});

requestAnimationFrame(frame);
