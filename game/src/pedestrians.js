// Solmar Bay pedestrians: the crowd that makes the city feel alive. They walk
// the sidewalks, cross at intersections, chat in the park, and run when a
// gunshot goes off or a police chase barrels past.
import { CITY, clamp, dist2D, nearestStreetCoord } from './config.js';
import { resolveCircleCollision } from './city.js';

const SHIRTS = [0xe86a5a, 0x5a8cd8, 0x7ac98a, 0xe8c33a, 0xd86fb0, 0x8a7ad8, 0xf2f2ea, 0x4a4a4a];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x6a7a8a];

function makePedestrianMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.7, 4, 8), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  for (const sx of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.45, 4, 6), new THREE.MeshLambertMaterial({ color: pants }));
    leg.position.set(sx, 0.5, 0);
    group.add(leg);
  }
  return group;
}

export function createPedestrians(scene, count, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const peds = [];
  for (let i = 0; i < count; i++) {
    const street = CITY.streets[Math.floor(rnd() * CITY.streets.length)];
    const along = -180 + rnd() * 360;
    const horizontal = rnd() < 0.5;
    const x = horizontal ? along : street + (rnd() < 0.5 ? 10.5 : -10.5);
    const z = horizontal ? street + (rnd() < 0.5 ? 10.5 : -10.5) : along;
    const mesh = makePedestrianMesh(
      SHIRTS[Math.floor(rnd() * SHIRTS.length)],
      PANTS[Math.floor(rnd() * PANTS.length)],
      [0xc98d64, 0x8a5a3a, 0xe8b88a, 0x6a4a2a][Math.floor(rnd() * 4)],
    );
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      heading: horizontal ? (rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rnd() < 0.5 ? 0 : Math.PI),
      speed: 1.2 + rnd() * 1.1,
      axis: horizontal ? 'x' : 'z',
      dir: rnd() < 0.5 ? 1 : -1,
      phase: rnd() * Math.PI * 2,
      fleeing: 0,
      waitingForTaxi: rnd() < 0.18,
    });
  }
  return peds;
}

// Everyone near a gunshot or a siren runs away from it for a few seconds.
export function scarePedestrians(peds, x, z, radius) {
  for (const p of peds) {
    if (dist2D(p.x, p.z, x, z) < radius) p.fleeing = 3;
  }
}

export function updatePedestrians(peds, dt, player, colliders) {
  for (const p of peds) {
    let speed = p.speed;
    let heading = p.heading;
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      speed = 5;
      // Run directly away from the player.
      const dx = p.x - player.x;
      const dz = p.z - player.z;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
      heading = Math.atan2(dx / d, dz / d);
    } else {
      // Stroll along the sidewalk; turn at intersections sometimes.
      const along = p.axis === 'x' ? p.x : p.z;
      if (Math.abs(along - nearestStreetCoord(along)) < 1 && Math.random() < 0.003) {
        p.axis = p.axis === 'x' ? 'z' : 'x';
        p.dir = Math.random() < 0.5 ? 1 : -1;
        const lane = 10.5 * (Math.random() < 0.5 ? 1 : -1);
        if (p.axis === 'x') {
          p.z = nearestStreetCoord(p.z) + lane;
          heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          p.x = nearestStreetCoord(p.x) + lane;
          heading = p.dir > 0 ? 0 : Math.PI;
        }
      }
    }
    p.heading = heading;
    const nx = p.x + Math.sin(heading) * speed * dt;
    const nz = p.z + Math.cos(heading) * speed * dt;
    const pushed = resolveCircleCollision(nx, nz, 0.5, colliders);
    p.x = clamp(pushed.x, -195, 195);
    p.z = clamp(pushed.z, -195, 205);
    p.phase += dt * speed * 2.2;
    p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.05, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.rotation.z = Math.sin(p.phase) * 0.05;
  }
}
