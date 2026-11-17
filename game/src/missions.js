// Solmar Bay story: five missions for Dario Cruz, from his first stolen car to
// the sunset showdown at the lighthouse — plus the side work that pays between
// jobs: taxi fares and the golden sun coins hidden around the city.
import { dist2D, formatCash, mulberry32 } from './config.js';
import { spawnGuard } from './combat.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 300,
    briefing: 'Mara needs a driver. Steal a car and bring it to her garage.',
    steps: [
      { type: 'steal', text: 'Steal a car — walk up to any car and press E' },
      { type: 'goto', target: 'garage', radius: 10, text: 'Drive to Mara\'s Garage' },
    ],
  },
  {
    id: 'courier-run', title: 'Courier Run', reward: 450,
    briefing: 'A package for the north side. Fast, quiet, no questions.',
    steps: [
      { type: 'goto', target: 'kiosk', radius: 8, text: 'Pick up the package at the Boardwalk Kiosk' },
      { type: 'timed-goto', target: 'safehouse', radius: 10, seconds: 90, text: 'Deliver the package to the Safehouse — 90 seconds!' },
    ],
  },
  {
    id: 'getaway', title: 'Getaway', reward: 600,
    briefing: 'The crew is waiting in the park. The cops are already on the move.',
    steps: [
      { type: 'goto', target: 'park', radius: 8, text: 'Pick up the crew at Solmar Park' },
      { type: 'escape', target: 'safehouse', radius: 12, text: 'Lose the cops, then reach the Safehouse' },
    ],
  },
  {
    id: 'harbor-heist', title: 'Harbor Heist', reward: 800,
    briefing: 'Three crates on the docks. The harbor guards are armed. So are you.',
    steps: [
      { type: 'goto', target: 'docks', radius: 12, text: 'Reach the Solmar Docks' },
      { type: 'collect', count: 3, text: 'Grab the 3 crates — watch the guards' },
    ],
  },
  {
    id: 'sunset-showdown', title: 'Sunset Showdown', reward: 1200,
    briefing: 'One last job at the lighthouse. Take the crew, take the loot, take the city.',
    steps: [
      { type: 'goto', target: 'lighthouse', radius: 12, text: 'Reach the Lighthouse' },
      { type: 'eliminate', text: 'Clear out the lighthouse guards' },
      { type: 'goto', target: 'garage', radius: 10, text: 'Bring the loot home to Mara\'s Garage' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0, step: 0, timer: 0,
    guardsSpawned: false, crates: [],
    done: false, stepStarted: false,
  };
}

function playerPos(player) {
  return player.onFoot ? { x: player.x, z: player.z } : { x: player.car.x, z: player.car.z };
}

function currentStep(missions) {
  const m = MISSIONS[missions.index];
  return m ? m.steps[missions.step] : null;
}

export function currentObjective(missions) {
  if (missions.done) return 'Free roam — taxi fares (T) and sun coins pay. Story complete!';
  const m = MISSIONS[missions.index];
  const s = currentStep(missions);
  if (!m || !s) return '';
  return `Mission ${missions.index + 1}/5 · ${m.title}: ${s.text}`;
}

export function currentTarget(missions, locations) {
  const s = currentStep(missions);
  if (!s || !s.target) return null;
  const loc = locations[s.target];
  return loc ? { x: loc.x, z: loc.z } : null;
}

// Spawn the crates for the heist step around the docks.
function spawnCrates(ctx, missions) {
  const { scene, city } = ctx;
  missions.crates = [];
  const spots = [
    { x: -182, z: 34 }, { x: -176, z: 48 }, { x: -186, z: 58 },
  ];
  for (const spot of spots) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: 0xffc23a, emissive: 0x8a6a00, emissiveIntensity: 0.5 }),
    );
    mesh.position.set(spot.x, 1.2, spot.z);
    mesh.castShadow = true;
    scene.add(mesh);
    missions.crates.push({ ...spot, mesh, taken: false });
  }
}

function spawnMissionGuards(ctx, count, around) {
  const { combat, scene } = ctx;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    spawnGuard(combat, scene, around.x + Math.cos(a) * 10, around.z + Math.sin(a) * 10);
  }
}

export function updateMissions(missions, ctx, dt) {
  if (missions.done) return;
  const m = MISSIONS[missions.index];
  const s = currentStep(missions);
  if (!m || !s) return;
  const { player, state, city, hud, audio } = ctx;
  const pos = playerPos(player);

  if (!missions.stepStarted) {
    missions.stepStarted = true;
    if (s.type === 'timed-goto') missions.timer = s.seconds;
    if (s.type === 'escape') ctx.raiseWanted(2);
    if (s.type === 'collect') spawnCrates(ctx, missions);
    if (m.id === 'harbor-heist' && s.type === 'collect' && !missions.guardsSpawned) {
      missions.guardsSpawned = true;
      spawnMissionGuards(ctx, 3, city.locations.docks);
    }
    if (m.id === 'sunset-showdown' && s.type === 'eliminate' && !missions.guardsSpawned) {
      missions.guardsSpawned = true;
      spawnMissionGuards(ctx, 4, city.locations.lighthouse);
    }
    if (hud) hud.toast(`Mission ${missions.index + 1}: ${m.title} — ${m.briefing}`, 'info');
  }

  let complete = false;
  if (s.type === 'steal') {
    complete = !player.onFoot;
  } else if (s.type === 'goto' || s.type === 'timed-goto') {
    const loc = city.locations[s.target];
    complete = dist2D(pos.x, pos.z, loc.x, loc.z) < s.radius;
    if (s.type === 'timed-goto') {
      missions.timer -= dt;
      if (missions.timer <= 0 && !complete) {
        missions.timer = s.seconds;
        if (hud) hud.toast('Too slow! The client walked. Try the delivery again.', 'bad');
        return;
      }
    }
  } else if (s.type === 'collect') {
    for (const crate of missions.crates) {
      if (!crate.taken && dist2D(pos.x, pos.z, crate.x, crate.z) < 3.2) {
        crate.taken = true;
        ctx.scene.remove(crate.mesh);
        if (audio) audio.pickup();
        if (hud) hud.toast(`Crate secured (${missions.crates.filter((c) => c.taken).length}/3)`, 'good');
      }
    }
    complete = missions.crates.length > 0 && missions.crates.every((c) => c.taken);
  } else if (s.type === 'escape') {
    const loc = city.locations[s.target];
    complete = state.wanted === 0 && dist2D(pos.x, pos.z, loc.x, loc.z) < s.radius;
  } else if (s.type === 'eliminate') {
    complete = ctx.combat.enemies.every((e) => e.dead);
  }

  if (!complete) return;
  missions.step += 1;
  missions.stepStarted = false;
  missions.timer = 0;
  if (missions.step >= m.steps.length) {
    state.cash += m.reward;
    if (hud) hud.banner('MISSION COMPLETE', `${m.title} — +${formatCash(m.reward)}`);
    if (audio) audio.missionJingle();
    missions.index += 1;
    missions.step = 0;
    missions.guardsSpawned = false;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      state.cash += 500;
      if (hud) hud.banner('STORY COMPLETE', 'Dario owns Solmar Bay. Bonus +$500 — keep playing!');
    }
    ctx.saveGame();
  } else if (audio) {
    audio.pickup();
  }
}

// --- Side activities ----------------------------------------------------------

// Twenty golden sun coins hidden around the city: $25 each.
export function createCoins(scene, seed) {
  const random = mulberry32(seed);
  const coins = [];
  const geo = new THREE.TorusGeometry(0.7, 0.28, 8, 16);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffc23a, emissive: 0xa87600, emissiveIntensity: 0.6 });
  for (let i = 0; i < 20; i++) {
    const street = [-160, -120, -80, -40, 0, 40, 80, 120, 160][Math.floor(random() * 9)];
    const along = -170 + random() * 340;
    const x = random() < 0.5 ? street + (random() < 0.5 ? 11 : -11) : along;
    const z = random() < 0.5 ? along : street + (random() < 0.5 ? 11 : -11);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.4, z);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
    coins.push({ x, z, mesh, taken: false, spin: random() * Math.PI * 2 });
  }
  // Three on the beach, for the view.
  for (const [x, z] of [[-60, 184], [80, 186], [150, 182]]) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.4, z);
    scene.add(mesh);
    coins.push({ x, z, mesh, taken: false, spin: 0 });
  }
  return coins;
}

export function updateCoins(coins, ctx, dt) {
  const { player, state, audio, hud } = ctx;
  const pos = playerPos(player);
  for (const c of coins) {
    if (c.taken) continue;
    c.spin += dt * 2;
    c.mesh.rotation.y = c.spin;
    c.mesh.position.y = 1.4 + Math.sin(c.spin * 1.5) * 0.15;
    if (dist2D(pos.x, pos.z, c.x, c.z) < 2.6) {
      c.taken = true;
      ctx.scene.remove(c.mesh);
      state.cash += 25;
      state.coinsCollected = (state.coinsCollected || 0) + 1;
      if (audio) audio.coin();
      if (hud) hud.toast('Sun coin! +$25', 'good');
    }
  }
}

// Taxi fares: press T in a car near a waiting pedestrian to take them somewhere.
export function createTaxi() {
  return { active: false, passenger: null, dest: null, timer: 0, destName: '' };
}

const FARE_SPOTS = [
  ['Solmar Park', -20, -20], ['Mara\'s Garage', -140, -84], ['Hospital', 140, -122],
  ['Boardwalk Kiosk', 40, 180], ['The Docks', -178, 44], ['Lighthouse Point', -168, 182],
  ['Safehouse', 120, 120], ['Beach Bar', 100, 182],
];

export function tryStartTaxi(taxi, ctx) {
  const { player, peds, hud, city } = ctx;
  if (!player.onFoot && !taxi.active) {
    const pos = { x: player.car.x, z: player.car.z };
    for (const p of peds) {
      if (p.waitingForTaxi && dist2D(pos.x, pos.z, p.x, p.z) < 8) {
        const spot = FARE_SPOTS[Math.floor(Math.random() * FARE_SPOTS.length)];
        taxi.active = true;
        taxi.passenger = p;
        taxi.dest = { x: spot[1], z: spot[2] };
        taxi.destName = spot[0];
        taxi.timer = 75;
        p.waitingForTaxi = false;
        if (hud) hud.toast(`Fare! Take your passenger to ${spot[0]} — 75 seconds.`, 'info');
        return true;
      }
    }
    if (hud) hud.toast('No passenger waiting nearby. Look for someone waving by the road.', 'info');
  }
  return false;
}

export function updateTaxi(taxi, ctx, dt) {
  if (!taxi.active) return;
  const { player, state, hud, audio } = ctx;
  const pos = player.onFoot ? { x: player.x, z: player.z } : { x: player.car.x, z: player.car.z };
  taxi.timer -= dt;
  if (dist2D(pos.x, pos.z, taxi.dest.x, taxi.dest.z) < 10) {
    const tip = Math.max(0, Math.floor(taxi.timer));
    const fare = 60 + tip;
    state.cash += fare;
    taxi.active = false;
    if (audio) audio.missionJingle();
    if (hud) hud.toast(`Fare complete! +${formatCash(fare)} (tip $${tip})`, 'good');
    ctx.saveGame();
  } else if (taxi.timer <= 0) {
    taxi.active = false;
    if (hud) hud.toast('The passenger gave up and walked away.', 'bad');
  }
}
