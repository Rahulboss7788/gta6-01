// Solmar Bay police: the wanted system. Stars rise when Dario steals, shoots
// or runs someone over; patrol cars spawn and chase, lights flashing, and try
// to ram him off the road or bust him on foot. Lay low and the heat cools off.
import { TUNING, clamp, dist2D } from './config.js';
import { createPoliceCar } from './vehicles.js';
import { resolveCircleCollision } from './city.js';

export function createPolice(scene) {
  return { cars: [], officers: [], decayTimer: 0, flash: 0 };
}

// Wanted stars, 0..5. Raising them spawns a siren and a toast.
export function raiseWanted(state, amount, hud) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, 5);
  if (state.wanted > before && hud) {
    hud.toast('WANTED LEVEL ' + '★'.repeat(state.wanted) + ' — the Solmar Bay PD is on you!', 'bad');
  }
}

export function updatePolice(police, ctx, dt) {
  const { scene, player, state, city, audio, hud } = ctx;
  police.flash += dt;
  const wanted = state.wanted;
  // Keep one patrol car per star (up to 4) on the streets.
  const wantCars = wanted === 0 ? 0 : Math.min(4, wanted + 1);
  while (police.cars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    const px = player.onFoot ? player.x : player.car.x;
    const pz = player.onFoot ? player.z : player.car.z;
    const car = createPoliceCar(scene, clamp(px + Math.sin(a) * 70, -190, 190), clamp(pz + Math.cos(a) * 70, -190, 200), a);
    car.speed = 10;
    police.cars.push(car);
  }
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    scene.remove(car.group);
  }
  const px = player.onFoot ? player.x : player.car.x;
  const pz = player.onFoot ? player.z : player.car.z;
  let nearestPolice = Infinity;
  for (const car of police.cars) {
    // Chase: steer straight at the player, faster than traffic, with building
    // collision so patrol cars slide along walls instead of driving through them.
    const dx = px - car.x;
    const dz = pz - car.z;
    const d = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
    nearestPolice = Math.min(nearestPolice, d);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    car.speed = Math.min(TUNING.policeSpeed, car.speed + 12 * dt);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const pushed = resolveCircleCollision(nx, nz, 2.2, city.colliders);
    car.x = pushed.x;
    car.z = pushed.z;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    // Flashing light bar.
    const on = Math.sin(police.flash * 10) > 0;
    if (car.beaconRed) car.beaconRed.visible = on;
    if (car.beaconBlue) car.beaconBlue.visible = !on;
    // Ramming the player's car damages it; touching the player on foot busts him.
    if (!player.onFoot && player.car && d < 4.2) {
      player.car.health -= 14 * dt;
      player.car.speed *= 1 - 0.4 * dt;
      if (Math.random() < dt * 2 && audio) audio.crash();
    }
    if (player.onFoot && d < 2.6) {
      player.bustTimer += dt;
      if (player.bustTimer > 1.6) ctx.onBusted();
    } else if (player.onFoot) {
      player.bustTimer = Math.max(0, player.bustTimer - dt);
    }
  }
  // Heat cools off when no patrol car is close for a while.
  if (wanted > 0) {
    if (nearestPolice > 55) {
      police.decayTimer += dt;
      if (police.decayTimer > TUNING.wantedDecaySeconds) {
        state.wanted -= 1;
        police.decayTimer = 0;
        if (hud) hud.toast('The heat is cooling off… wanted level ' + state.wanted, 'good');
      }
    } else {
      police.decayTimer = 0;
    }
  }
  if (audio) audio.setSiren(wanted > 0, police.flash);
}

export function clearPolice(police, scene) {
  for (const car of police.cars) scene.remove(car.group);
  police.cars = [];
  for (const o of police.officers) scene.remove(o.group);
  police.officers = [];
}
