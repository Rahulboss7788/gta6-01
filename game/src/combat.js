// Solmar Bay combat: Dario's pistol (mouse click to shoot), his fists (F),
// the dock guards who shoot back, and the little bursts of light and smoke
// that make a fight read at a glance.
import { TUNING, dist2D } from './config.js';
import { scarePedestrians } from './pedestrians.js';

function makeGuardMesh() {
  const group = new THREE.Group();
  const vest = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 4, 8), vest);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05;
  group.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1c1e22 }));
  helmet.position.y = 2.08;
  group.add(helmet);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.3, 0.4);
  group.add(gun);
  return group;
}

export function createCombat(scene) {
  return {
    enemies: [], // dock guards / crew shooters
    cooldown: 0,
    tracers: [],
    bursts: [],
    muzzle: null,
  };
}

export function spawnGuard(combat, scene, x, z) {
  const group = makeGuardMesh();
  group.position.set(x, 0, z);
  scene.add(group);
  const guard = { group, x, z, health: 100, shootTimer: 1 + Math.random(), heading: 0, dead: false };
  combat.enemies.push(guard);
  return guard;
}

// A short-lived tracer line from muzzle to impact point.
function addTracer(combat, scene, from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  scene.add(line);
  combat.tracers.push({ line, life: 0.12 });
}

// A burst of golden sparks / grey smoke at a point.
export function addBurst(combat, scene, x, y, z, color, count) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocities.push([(Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 0.95 }));
  scene.add(points);
  combat.bursts.push({ points, velocities, life: 0.6 });
}

export function updateCombatFx(combat, scene, dt) {
  for (const t of combat.tracers) {
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.12);
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
    }
  }
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
  for (const b of combat.bursts) {
    b.life -= dt;
    const pos = b.points.geometry.attributes.position;
    for (let i = 0; i < b.velocities.length; i++) {
      pos.array[i * 3] += b.velocities[i][0] * dt;
      pos.array[i * 3 + 1] += b.velocities[i][1] * dt;
      pos.array[i * 3 + 2] += b.velocities[i][2] * dt;
      b.velocities[i][1] -= 12 * dt;
    }
    pos.needsUpdate = true;
    b.points.material.opacity = Math.max(0, b.life / 0.6);
    if (b.life <= 0) {
      scene.remove(b.points);
      b.points.geometry.dispose();
    }
  }
  combat.bursts = combat.bursts.filter((b) => b.life > 0);
}

// Fire the pistol from the camera through the crosshair. Returns what it hit.
export function shootPistol(ctx) {
  const { combat, scene, camera, player, state, peds, audio, hud } = ctx;
  if (combat.cooldown > 0 || player.health <= 0) return null;
  combat.cooldown = TUNING.shotCooldown;
  if (audio) audio.gunshot();
  if (state) state.shotsFired = (state.shotsFired || 0) + 1;
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const muzzle = origin.clone().add(dir.clone().multiplyScalar(2));
  let best = null;
  let bestT = 120;
  // Enemies first, then pedestrians, then cars (a ray-sphere test per target).
  const targets = [];
  for (const e of combat.enemies) if (!e.dead) targets.push({ x: e.x, y: 1.3, z: e.z, r: 1.1, kind: 'enemy', ref: e });
  for (const p of peds) targets.push({ x: p.x, y: 1.2, z: p.z, r: 0.9, kind: 'ped', ref: p });
  for (const t of targets) {
    const to = new THREE.Vector3(t.x - origin.x, t.y - origin.y, t.z - origin.z);
    const along = to.dot(dir);
    if (along < 0 || along > bestT) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(along));
    const d = Math.sqrt((t.x - closest.x) ** 2 + (t.y - closest.y) ** 2 + (t.z - closest.z) ** 2);
    if (d < t.r) {
      bestT = along;
      best = t;
    }
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : 90));
  addTracer(combat, scene, muzzle, end, 0xffe9a0);
  addBurst(combat, scene, muzzle.x, muzzle.y, muzzle.z, 0xffc23a, 6);
  if (best) {
    addBurst(combat, scene, best.x, best.y, best.z, 0xff5533, 10);
    if (best.kind === 'enemy') {
      best.ref.health -= TUNING.shotDamage;
      if (best.ref.health <= 0 && !best.ref.dead) {
        best.ref.dead = true;
        scene.remove(best.ref.group);
        if (state) state.cash += 50;
        if (hud) hud.toast('Guard down — +$50', 'good');
      }
    } else {
      // Hitting a bystander is a crime: the heat rises and the crowd scatters.
      scarePedestrians(peds, best.ref.x, best.ref.z, 40);
      if (ctx.raiseWanted) ctx.raiseWanted(1);
    }
  } else {
    scarePedestrians(peds, player.x, player.z, 30);
  }
  return best;
}

// F: a punch at whatever is closest — a guard, a pedestrian, or a car window.
export function punch(ctx) {
  const { combat, player, peds, audio, hud, state } = ctx;
  if (audio) audio.punch();
  const px = player.onFoot ? player.x : player.car.x;
  const pz = player.onFoot ? player.z : player.car.z;
  for (const e of combat.enemies) {
    if (!e.dead && dist2D(px, pz, e.x, e.z) < 2.6) {
      e.health -= TUNING.punchDamage;
      addBurst(combat, ctx.scene, e.x, 1.4, e.z, 0xffc23a, 8);
      if (e.health <= 0) {
        e.dead = true;
        ctx.scene.remove(e.group);
        if (state) state.cash += 50;
        if (hud) hud.toast('Guard down — +$50', 'good');
      }
      return 'enemy';
    }
  }
  for (const p of peds) {
    if (dist2D(px, pz, p.x, p.z) < 2.4) {
      scarePedestrians(peds, p.x, p.z, 30);
      if (ctx.raiseWanted) ctx.raiseWanted(1);
      return 'ped';
    }
  }
  return null;
}

// Guards stand their ground and fire back at Dario, badly, when he is close.
export function updateEnemies(combat, ctx, dt) {
  const { scene, player, audio } = ctx;
  const px = player.onFoot ? player.x : player.car.x;
  const pz = player.onFoot ? player.z : player.car.z;
  for (const e of combat.enemies) {
    if (e.dead) continue;
    const d = dist2D(px, pz, e.x, e.z);
    e.heading = Math.atan2(px - e.x, pz - e.z);
    e.group.rotation.y = e.heading;
    e.shootTimer -= dt;
    if (d < 45 && e.shootTimer <= 0) {
      e.shootTimer = 1.1 + Math.random() * 0.8;
      const from = new THREE.Vector3(e.x, 1.4, e.z);
      const to = new THREE.Vector3(px + (Math.random() - 0.5) * 4, 1.2, pz + (Math.random() - 0.5) * 4);
      addTracer(combat, scene, from, to, 0xff6644);
      if (audio) audio.gunshot();
      // A stray round sometimes lands: Dario takes a hit.
      if (Math.random() < 0.3 && player.onFoot) {
        player.health -= 8;
        if (ctx.hud) ctx.hud.flashDamage();
      }
    }
  }
  combat.enemies = combat.enemies.filter((e) => !e.dead || e.group.parent);
}
