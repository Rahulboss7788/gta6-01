// Solmar Bay player: Dario Cruz, on foot and behind the wheel. Third-person
// movement, jumping, camera orbit and stealing/driving cars (the E key).
import { TUNING, clamp, angleLerp } from './config.js';
import { resolveCircleCollision } from './city.js';
import { updatePlayerCar } from './vehicles.js';

export function createPlayer(scene, x, z) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd84a3a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 4, 8), jacket);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0xf2c94c }));
  cap.position.y = 2.3;
  group.add(cap);
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 4, 6), jeans);
    leg.position.set(sx, 0.55, 0);
    group.add(leg);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    group, x, z, y: 0, vy: 0, heading: 0,
    health: TUNING.playerMaxHealth,
    onFoot: true, car: null, carName: '',
    cameraYaw: Math.PI, cameraPitch: 0.32, cameraDist: 9,
    walkPhase: 0, bustTimer: 0, invulnerable: 0,
  };
}

// Camera-relative on-foot movement with building collision and a small jump.
export function updatePlayerOnFoot(player, input, dt, colliders, audio) {
  const axes = input.moveAxes();
  const drag = input.takeCameraDrag();
  player.cameraYaw += drag.yaw;
  player.cameraPitch = clamp(player.cameraPitch + drag.pitch, -0.1, 1.1);
  player.cameraDist = clamp(player.cameraDist + input.takeWheel() * 0.005, 5, 16);
  const speed = input.sprint() ? TUNING.runSpeed : TUNING.walkSpeed;
  const sin = Math.sin(player.cameraYaw);
  const cos = Math.cos(player.cameraYaw);
  // Forward on screen is away from the camera: -sin/-cos of the yaw.
  let mx = (-sin * axes.fwd + cos * axes.strafe) * speed;
  let mz = (-cos * axes.fwd - sin * axes.strafe) * speed;
  const moving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
  if (moving) {
    const targetHeading = Math.atan2(mx, mz);
    player.heading = angleLerp(player.heading, targetHeading, Math.min(1, dt * 12));
    player.walkPhase += dt * speed * 1.4;
    player.group.rotation.z = Math.sin(player.walkPhase) * 0.06;
  } else {
    player.group.rotation.z = 0;
  }
  const nx = player.x + mx * dt;
  const nz = player.z + mz * dt;
  const pushed = resolveCircleCollision(nx, nz, 0.6, colliders);
  player.x = clamp(pushed.x, -198, 198);
  player.z = clamp(pushed.z, -198, 212);
  // Jump: simple gravity, land back on the street.
  if (input.jump() && player.y === 0) player.vy = 7;
  player.vy -= 22 * dt;
  player.y = Math.max(0, player.y + player.vy * dt);
  if (player.y === 0) player.vy = 0;
  player.group.position.set(player.x, player.y + Math.abs(Math.sin(player.walkPhase)) * (moving ? 0.08 : 0), player.z);
  player.group.rotation.y = player.heading;
  if (audio) audio.setEngine(0, false);
  return moving;
}

// Chase camera: behind the player on foot, further back and lower behind a car.
export function updateCamera(player, camera, dt) {
  const target = player.onFoot
    ? { x: player.x, y: player.y + 1.8, z: player.z }
    : { x: player.car.x, y: 1.6, z: player.car.z };
  const dist = player.onFoot ? player.cameraDist : 13;
  const pitch = player.onFoot ? player.cameraPitch : 0.3;
  let yaw = player.cameraYaw;
  if (!player.onFoot) {
    // Driving: the camera settles behind the car unless the player drags it.
    yaw = angleLerp(yaw, player.car.heading + Math.PI, Math.min(1, dt * 1.2));
    player.cameraYaw = yaw;
  }
  const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cy = target.y + Math.sin(pitch) * dist + 1.2;
  camera.position.set(cx, Math.max(cy, 1.2), cz);
  camera.lookAt(target.x, target.y, target.z);
}

// E: climb into the nearest car (stealing it raises the wanted level) or step out.
export function tryEnterExitCar(player, vehicles, state, audio, onSteal) {
  if (player.onFoot) {
    const car = vehicles.nearest;
    if (!car) return 'No car close enough — walk up to one and press E.';
    player.onFoot = false;
    player.car = car;
    player.carName = vehicles.name;
    player.group.visible = false;
    car.isPlayer = true;
    if (!car.wasStolen) {
      car.wasStolen = true;
      onSteal();
    }
    if (audio) audio.horn();
    return 'Driving the ' + player.carName + '. W A S D to drive, Space to brake, E to get out.';
  }
  player.onFoot = true;
  player.car.isPlayer = false;
  const outX = player.car.x - Math.sin(player.car.heading + Math.PI / 2) * 3;
  const outZ = player.car.z - Math.cos(player.car.heading + Math.PI / 2) * 3;
  player.x = outX;
  player.z = outZ;
  player.y = 0;
  player.group.visible = true;
  player.group.position.set(player.x, 0, player.z);
  player.car.speed = 0;
  player.car = null;
  player.carName = '';
  if (audio) audio.setEngine(0, false);
  return 'On foot. Find your next ride — or your next job.';
}
