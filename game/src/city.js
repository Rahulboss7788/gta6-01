// Solmar Bay city builder: a sun-soaked coastal grid city — streets, blocks of
// varied buildings, a central park, a beach and boardwalk, docks and a lighthouse.
// Returns the colliders every other system uses, plus the named story locations.
import { CITY, mulberry32 } from './config.js';
import { makeBuildingTexture, makeRoadTexture, makeSandTexture, makeSignTexture } from './textures.js';

const PALETTES = [
  ['#f2c9a0', '#e07a4a', 0.45],
  ['#f7e3c2', '#c96f3f', 0.35],
  ['#d9e6e8', '#4a7d8c', 0.55],
  ['#e8b4b8', '#8c4a5a', 0.4],
  ['#cfe0b8', '#5a7d4a', 0.3],
  ['#e8d27a', '#7d6a2a', 0.5],
  ['#b8c8e8', '#3f5a8c', 0.6],
  ['#f0f0ea', '#8c8c7d', 0.4],
];

// Push a circle (x,z,radius) out of every building AABB it overlaps.
export function resolveCircleCollision(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = x - c.minX + radius;
        const pushR = c.maxX - x + radius;
        const pushT = z - c.minZ + radius;
        const pushB = c.maxZ - z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) x = c.minX - radius;
        else if (m === pushR) x = c.maxX + radius;
        else if (m === pushT) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z };
}

function addBox(scene, w, h, d, x, y, z, material, colliders, collide) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return mesh;
}

function makePalm(scene, x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * s, 0.3 * s, 5 * s, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  trunk.position.y = 2.5 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8c4a });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 2.6 * s, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1 * s, 5.2 * s, Math.sin(a) * 1.1 * s);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

export function buildCity(scene, seed) {
  const random = mulberry32(seed);
  const colliders = [];
  const lamps = [];
  const roadTex = makeRoadTexture();
  const sandTex = makeSandTexture();

  // Ground: pale concrete across the whole island, plain so the roads read.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshLambertMaterial({ color: 0xa39e93 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: one dark asphalt strip per street. East-west streets run along X
  // (a wide plane at height z = street), north-south streets run along Z.
  const roadTexEW = roadTex.clone();
  roadTexEW.needsUpdate = true;
  roadTexEW.repeat.set(30, 1);
  const roadTexNS = roadTex.clone();
  roadTexNS.needsUpdate = true;
  roadTexNS.repeat.set(1, 30);
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTexEW });
  const roadMatNS = new THREE.MeshLambertMaterial({ map: roadTexNS });
  for (const s of CITY.streets) {
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(430, 14), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.02, s);
    ew.receiveShadow = true;
    scene.add(ew);
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(14, 430), roadMatNS);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(s, 0.02, 10);
    ns.receiveShadow = true;
    scene.add(ns);
  }

  // Beach and sea to the south — the sun-soaked edge of Solmar Bay.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 44),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sandTex.repeat.set(12, 2);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, 194);
  beach.receiveShadow = true;
  scene.add(beach);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 260),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, 340);
  scene.add(water);
  // Boardwalk planks along the beach.
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(430, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xb98d5f }),
  );
  boardwalk.position.set(0, 0.15, 176);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  // Buildings, one or two per block, skipping the park, beach row edges and docks.
  const facadeMats = PALETTES.map(([base, trim, lit]) => {
    const tex = makeBuildingTexture(base, trim, lit, random);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a4a5a });

  // Blocks sit between streets: centres -140..140 in both axes (8 x 8 blocks).
  for (let kx = 0; kx < 8; kx++) {
    for (let kz = 0; kz < 8; kz++) {
      const blockX = -140 + kx * 40;
      const blockZ = -140 + kz * 40;
      // Mara's Garage, the hospital and the central park get their own builds.
      if (blockX === -140 && blockZ === -100) continue;
      if (blockX === 140 && blockZ === -140) continue;
      if (blockX === -20 && blockZ === -20) continue;
      // The beach row keeps low beach bars, not towers.
      const beachRow = blockZ >= 120;
      const count = beachRow ? 1 : random() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = 10 + random() * 8;
        const d = 10 + random() * 8;
        const h = beachRow ? 6 + random() * 5 : 8 + random() * (blockZ < -80 ? 34 : 22);
        const ox = count === 1 ? 0 : (i === 0 ? -6 : 6);
        const oz = count === 1 ? 0 : (i === 0 ? -5 : 5);
        const mat = facadeMats[Math.floor(random() * facadeMats.length)];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
        mesh.position.set(blockX + ox, h / 2, blockZ + oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        colliders.push({
          minX: blockX + ox - w / 2, maxX: blockX + ox + w / 2,
          minZ: blockZ + oz - d / 2, maxZ: blockZ + oz + d / 2,
        });
        // A few towers get a glass crown.
        if (h > 30 && random() < 0.5) {
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 3, d * 0.5), glassMat);
          crown.position.set(blockX + ox, h + 1.5, blockZ + oz);
          crown.castShadow = true;
          scene.add(crown);
        }
      }
    }
  }

  // Central park: lawn, palms, a fountain plaza (block centred on -20, -20).
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshLambertMaterial({ color: 0x5a8c4a }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(-20, 0.06, -20);
  lawn.receiveShadow = true;
  scene.add(lawn);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 1, 16), new THREE.MeshLambertMaterial({ color: 0xcfd8dc }));
  fountain.position.set(-20, 0.5, -20);
  fountain.castShadow = true;
  scene.add(fountain);
  const fountainWater = new THREE.Mesh(new THREE.CircleGeometry(3.4, 16), new THREE.MeshLambertMaterial({ color: 0x4aa8d8 }));
  fountainWater.rotation.x = -Math.PI / 2;
  fountainWater.position.set(-20, 1.02, -20);
  scene.add(fountainWater);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    makePalm(scene, -20 + Math.cos(a) * 13, -20 + Math.sin(a) * 13, 0.9 + random() * 0.4);
  }

  // Palms along the boardwalk and a few street corners.
  for (let x = -200; x <= 200; x += 20) {
    makePalm(scene, x + (random() - 0.5) * 4, 170 + random() * 3, 1);
    if (random() < 0.4) makePalm(scene, x, -168 + random() * 4, 0.9);
  }

  // Mara's Garage: low workshop with a big sign, in its own block north-west.
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xc96f3f });
  addBox(scene, 22, 7, 16, -140, 3.5, -100, garageMat, colliders, true);
  const garageSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture("MARA'S GARAGE", '#20242e', '#ffb347') }),
  );
  garageSign.position.set(-140, 8.5, -91.5);
  scene.add(garageSign);

  // Solmar General Hospital, north-east tower.
  const hospMat = facadeMats[2];
  const hosp = new THREE.Mesh(new THREE.BoxGeometry(20, 26, 16), [hospMat, hospMat, roofMat, roofMat, hospMat, hospMat]);
  hosp.position.set(140, 13, -140);
  hosp.castShadow = true;
  scene.add(hosp);
  colliders.push({ minX: 130, maxX: 150, minZ: -148, maxZ: -132 });
  const hospSign = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('HOSPITAL', '#f2f2ea', '#c0392b') }),
  );
  hospSign.position.set(140, 20, -131.5);
  scene.add(hospSign);

  // Docks: sheds and stacked crates on the west edge.
  const shedMat = new THREE.MeshLambertMaterial({ color: 0x7d8c9a });
  addBox(scene, 14, 8, 20, -188, 4, 20, shedMat, colliders, true);
  addBox(scene, 14, 8, 20, -188, 4, 60, shedMat, colliders, true);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xb98d3f });
  const crates = [];
  for (let i = 0; i < 8; i++) {
    const crate = addBox(scene, 3, 3, 3, -182 + random() * 8, 1.5, 30 + i * 4, crateMat, colliders, false);
    crates.push(crate);
  }

  // Lighthouse on the south-west point, with a rotating beam (animated in main).
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 22, 12), lightMat);
  tower.position.set(-168, 11, 190);
  tower.castShadow = true;
  scene.add(tower);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.0, 4, 12), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  stripe.position.set(-168, 14, 190);
  scene.add(stripe);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 12), new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xffc23a, emissiveIntensity: 0.9 }));
  lampRoom.position.set(-168, 23.5, 190);
  scene.add(lampRoom);
  colliders.push({ minX: -172, maxX: -164, minZ: 186, maxZ: 194 });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  beam.rotation.z = Math.PI / 2;
  beam.position.set(-168, 23.5, 190);
  scene.add(beam);

  // Street lamps at intersections (emissive heads, counted for the dusk look).
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xffc23a, emissiveIntensity: 0.7 });
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      if (Math.abs(sx) > 160 || Math.abs(sz) > 160) continue;
      if ((sx + sz) % 80 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), poleMat);
      pole.position.set(sx + 8.5, 3, sz + 8.5);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampHeadMat);
      head.position.set(sx + 8.5, 6.2, sz + 8.5);
      scene.add(head);
      lamps.push(head);
    }
  }

  // Soft clouds drifting high above the bay.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(10 + random() * 12, 8, 6), cloudMat);
    cloud.scale.y = 0.35;
    cloud.position.set(-220 + random() * 440, 70 + random() * 25, -220 + random() * 380);
    scene.add(cloud);
  }

  // Mission marker beacon: a golden pillar of light + a floating diamond, moved
  // by the mission system to the current objective.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(-140, 30, -100);
  scene.add(beacon);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
  diamond.position.set(-140, 9, -100);
  scene.add(diamond);

  return {
    colliders,
    crates,
    beam,
    beacon,
    diamond,
    lamps,
    locations: {
      garage: { x: -140, z: -84 },
      hospital: { x: 140, z: -122 },
      safehouse: { x: 120, z: 120 },
      docks: { x: -178, z: 44 },
      lighthouse: { x: -168, z: 182 },
      kiosk: { x: 40, z: 180 },
      park: { x: -20, z: -20 },
      spawn: { x: -128, z: -84 },
    },
  };
}
