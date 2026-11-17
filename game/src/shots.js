// Solmar Bay screenshot scenes behind ?shot=cover|drive|chase|mission. Each one
// sets up a real, playable state — a car on the avenue, a chase, a heist — then
// lets the live systems run a couple of seconds so the frame is what the game
// really looks like, with the HUD, minimap and mission marker in place.
import { createCar, createPoliceCar } from './vehicles.js';

function placeTrafficCar(car, x, z, axis, dir, speed) {
  car.axis = axis;
  car.dir = dir;
  car.x = x;
  car.z = z;
  car.speed = speed;
  car.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  car.group.position.set(x, 0, z);
  car.group.rotation.y = car.heading;
}

function putPlayerInCar(ctx, car) {
  const { player } = ctx;
  player.onFoot = false;
  player.car = car;
  player.carName = 'Palma GT';
  player.group.visible = false;
  car.isPlayer = true;
  player.cameraYaw = car.heading + Math.PI;
  player.cameraPitch = 0.3;
}

// Set the context to the named scene (cover, drive, chase or mission) and return
// the screen the HUD should show over it.
export function stageShot(name, ctx) {
  const { player, state, missions, police, scene, city, traffic } = ctx;
  state.minutes = 18 * 60 + 30; // golden hour, every time
  state.cash = 1240;
  missions.done = false;
  missions.guardsSpawned = false;
  missions.stepStarted = false;

  if (name === 'drive') {
    // On foot on the boardwalk, the city and the bay behind Dario.
    missions.index = 1;
    missions.step = 0;
    state.wanted = 0;
    player.onFoot = true;
    player.group.visible = true;
    player.x = 30;
    player.z = 176;
    player.y = 0;
    player.heading = Math.PI;
    player.cameraYaw = 0.15;
    player.cameraPitch = 0.34;
    player.cameraDist = 8;
    for (let i = 0; i < 4 && i < ctx.peds.length; i++) {
      const p = ctx.peds[i];
      p.x = 18 + i * 7;
      p.z = 172 + (i % 2) * 4;
      p.mesh.position.set(p.x, 0, p.z);
    }
    placeTrafficCar(traffic.cars[0], -40, 163.2, 'x', 1, 10);
    placeTrafficCar(traffic.cars[1], 60, 156.8, 'x', -1, 9);
    return 'play';
  }

  if (name === 'chase') {
    // Mission 3, escape step: wanted 4, three patrol cars right behind Dario.
    missions.index = 2;
    missions.step = 1;
    missions.stepStarted = true; // the escape heat is already on
    state.wanted = 4;
    const car = createCar(scene, 0, 40, Math.PI / 2, 'sedan', 0xd84a3a);
    putPlayerInCar(ctx, car);
    car.speed = 26;
    // Two patrol cars ahead in the frame (lights flashing, closing in) and
    // one behind, so the chase reads from the driver's own view.
    for (const [px, pz] of [[22, 35.5], [30, 45], [-14, 32]]) {
      const pc = createPoliceCar(scene, px, pz, Math.PI / 2);
      pc.speed = 26;
      police.cars.push(pc);
    }
    placeTrafficCar(traffic.cars[0], 70, 43.2, 'x', 1, 10);
    placeTrafficCar(traffic.cars[1], 95, 36.8, 'x', -1, 9);
    return 'play';
  }

  if (name === 'mission') {
    // Mission 4, heist step: the docks, the gold crates, the guards.
    missions.index = 3;
    missions.step = 1;
    state.wanted = 1;
    player.onFoot = true;
    player.group.visible = true;
    player.x = -166;
    player.z = 52;
    player.y = 0;
    player.heading = -2.3;
    player.cameraYaw = 0.7;
    player.cameraPitch = 0.3;
    player.cameraDist = 10;
    placeTrafficCar(traffic.cars[0], -120, 43.2, 'x', 1, 9);
    return 'play';
  }

  // Cover: mission 1, driving the stolen car to Mara's Garage down the avenue,
  // two patrol cars closing in behind, traffic ahead, wanted 2.
  missions.index = 0;
  missions.step = 1;
  state.wanted = 2;
  const car = createCar(scene, -20, -80, -Math.PI / 2, 'sedan', 0xd84a3a);
  putPlayerInCar(ctx, car);
  car.speed = 20;
  // Two patrol cars ahead in the frame and one closing in behind.
  for (const [px, pz] of [[-48, -75.5], [-58, -85], [4, -72]]) {
    const pc = createPoliceCar(scene, px, pz, -Math.PI / 2);
    pc.speed = 22;
    police.cars.push(pc);
  }
  placeTrafficCar(traffic.cars[0], -70, -76.8, 'x', -1, 10);
  placeTrafficCar(traffic.cars[1], -110, -83.2, 'x', -1, 9);
  placeTrafficCar(traffic.cars[2], -150, -76.8, 'x', 1, 8);
  return 'play';
}
