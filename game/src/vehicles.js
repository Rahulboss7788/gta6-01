// Solmar Bay vehicles: the car factory, the traffic that fills the streets, and
// the arcade driving model for the player's car. Cars are built from boxes,
// cylinders and a little chrome — no model files, all code.
import { CITY, TUNING, clamp, dist2D, nearestStreetCoord } from './config.js';
import { resolveCircleCollision } from './city.js';

const CAR_COLORS = [0xd84a3a, 0x3a6fd8, 0xe8c33a, 0x3ad8a0, 0xf2f2ea, 0x2a2f38, 0xd86fb0, 0x7a5ad8, 0x4a9a8c, 0xc96f3f];
const CAR_NAMES = ['Solmar Comet', 'Bayview Cruiser', 'Palma GT', 'Coral Coupe', 'Sunset Van', 'Marina Sedan', 'Dune Buggy', 'Harbor Taxi'];

function buildCarMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a38 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const bodyH = kind === 'van' ? 1.5 : 0.85;
  const bodyL = kind === 'van' ? 5.2 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyL), paint);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, kind === 'van' ? 3.4 : 2.2), kind === 'van' ? paint : glass);
  cabin.position.set(0, bodyH + 0.35, kind === 'van' ? -0.3 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.6 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), headMat);
    head.position.set(sx, 0.7, bodyL / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), new THREE.MeshLambertMaterial({ color: 0xd81f1f, emissive: 0x881111, emissiveIntensity: 0.5 }));
    tail.position.set(sx, 0.7, -bodyL / 2 - 0.02);
    group.add(tail);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelPositions = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  const wheels = [];
  for (const [wx, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels, bodyL };
}

export function createCar(scene, x, z, heading, kind, color) {
  const { group, wheels, bodyL } = buildCarMesh(color, kind);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, wheels, kind, color,
    x, z, heading, speed: 0,
    health: TUNING.carMaxHealth,
    isPlayer: false, isPolice: kind === 'police',
    // Traffic state: which street axis it follows and which way.
    axis: 'x', dir: 1, lane: 3.2,
    brakeLight: false,
  };
}

export function createPoliceCar(scene, x, z, heading) {
  const car = createCar(scene, x, z, heading, 'sedan', 0x1a1d22);
  car.isPolice = true;
  car.kind = 'police';
  // Light bar: red and blue beacons that flash in the police update.
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  red.position.set(-0.45, 1.55, -0.2);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
  blue.position.set(0.45, 1.55, -0.2);
  car.group.add(red);
  car.group.add(blue);
  car.beaconRed = red;
  car.beaconBlue = blue;
  const star = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  star.position.set(0, 1.2, 2.21);
  car.group.add(star);
  return car;
}

export function carDisplayName(car) {
  return CAR_NAMES[Math.abs(Math.floor(car.color)) % CAR_NAMES.length] || 'Solmar Sedan';
}

// --- Traffic ----------------------------------------------------------------

export function createTraffic(scene, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const cars = [];
  for (let i = 0; i < 18; i++) {
    const horizontal = rnd() < 0.5;
    const street = CITY.streets[Math.floor(rnd() * CITY.streets.length)];
    const along = -180 + rnd() * 360;
    const dir = rnd() < 0.5 ? 1 : -1;
    const kind = rnd() < 0.12 ? 'taxi' : rnd() < 0.12 ? 'van' : 'sedan';
    const color = kind === 'taxi' ? 0xe8c33a : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
    const car = createCar(scene, horizontal ? along : street + (dir > 0 ? 3.2 : -3.2), horizontal ? street + (dir > 0 ? 3.2 : -3.2) : along, horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), kind, color);
    car.axis = horizontal ? 'x' : 'z';
    car.dir = dir;
    car.speed = TUNING.trafficSpeed * (0.8 + rnd() * 0.4);
    cars.push(car);
  }
  // Parked cars along the avenue by Mara's Garage, so Dario's first job —
  // stealing a car — never means a long wait at the kerb.
  for (const [px, pz, heading] of [[-128, -76.8, -Math.PI / 2], [-118, -83.2, Math.PI / 2], [-100, -76.8, -Math.PI / 2], [40, -83.2, Math.PI / 2], [80, 36.8, -Math.PI / 2]]) {
    const parked = createCar(scene, px, pz, heading, 'sedan', CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]);
    parked.parked = true;
    parked.speed = 0;
    parked.axis = 'x';
    parked.dir = 1;
    cars.push(parked);
  }
  return { cars, rnd };
}

function trafficSteer(car, dt, others) {
  // Parked cars stay where they are until someone steals them.
  if (car.parked) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    return;
  }
  // Slow down for the car ahead on the same lane.
  let target = TUNING.trafficSpeed;
  for (const o of others) {
    if (o === car) continue;
    const dx = o.x - car.x;
    const dz = o.z - car.z;
    const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
    const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
    if (ahead > 0 && ahead < 10 && side < 4) target = Math.min(target, 3);
  }
  car.speed += clamp(target - car.speed, -8 * dt, 6 * dt);
  if (car.axis === 'x') car.x += car.dir * car.speed * dt;
  else car.z += car.dir * car.speed * dt;
  // At an intersection, sometimes turn onto the cross street.
  const along = car.axis === 'x' ? car.x : car.z;
  const near = nearestStreetCoord(along);
  if (Math.abs(along - near) < 1.2 && Math.random() < 0.004) {
    const cross = car.axis === 'x' ? 'z' : 'x';
    const newDir = Math.random() < 0.5 ? 1 : -1;
    const lane = newDir > 0 ? 3.2 : -3.2;
    if (cross === 'x') {
      car.axis = 'x';
      car.z = near + lane;
      car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'z';
      car.x = near + lane;
      car.heading = newDir > 0 ? 0 : Math.PI;
    }
    car.dir = newDir;
  }
  // Wrap around the far edge so the streets never empty out.
  if (car.x > 195) car.x = -195;
  if (car.x < -195) car.x = 195;
  if (car.z > 205) car.z = -195;
  if (car.z < -195) car.z = 205;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
}

export function updateTraffic(traffic, dt) {
  for (const car of traffic.cars) trafficSteer(car, dt, traffic.cars);
}

// --- Player driving -----------------------------------------------------------

export function updatePlayerCar(car, input, dt, colliders, audio) {
  const axes = input.moveAxes();
  const forward = axes.fwd;
  const steer = axes.strafe;
  const speed = car.speed;
  // Steering only bites while moving, and flips when reversing.
  const steerAuthority = clamp(Math.abs(speed) / 8, 0, 1) * (speed >= 0 ? 1 : -1);
  car.heading += steer * 1.9 * steerAuthority * dt * clamp(Math.abs(speed) / 6 + 0.3, 0, 1.4);
  if (forward > 0) car.speed += TUNING.carAccel * dt;
  else if (forward < 0) {
    if (speed > 0.5) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.7 * dt;
  } else {
    car.speed -= Math.sign(speed) * Math.min(Math.abs(speed), 8 * dt);
  }
  if (input.key('Space')) car.speed -= Math.sign(speed) * Math.min(Math.abs(speed), 22 * dt); // handbrake
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const pushed = resolveCircleCollision(nx, nz, 2.2, colliders);
  if ((pushed.x !== nx || pushed.z !== nz) && Math.abs(car.speed) > 6) {
    car.speed *= 0.45;
    if (audio) audio.crash();
  }
  car.x = clamp(pushed.x, -196, 196);
  car.z = clamp(pushed.z, -196, 210);
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  // Body roll and wheel spin sell the speed.
  car.group.rotation.z = -steer * 0.05 * clamp(Math.abs(car.speed) / 20, 0, 1);
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
  if (audio) audio.setEngine(Math.abs(car.speed) / TUNING.carMaxSpeed, true);
  return car;
}

// Nearest drivable car to a point (traffic, or a parked car the player left).
export function nearestCarTo(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = dist2D(x, z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
