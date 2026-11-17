// Solmar Bay shared constants: the city grid, tuning numbers and small helpers.
// Every system imports from here so the whole game agrees on one set of rules.
export const CITY = {
  streetSpacing: 40,
  streets: [-160, -120, -80, -40, 0, 40, 80, 120, 160],
  half: 200,
  roadHalf: 7,
  sidewalk: 3,
  beachZ: 172,
  waterZ: 196,
  dockX: -182,
};

export const TUNING = {
  walkSpeed: 7,
  runSpeed: 11,
  carAccel: 16,
  carMaxSpeed: 38,
  carReverseMax: 11,
  carBrake: 30,
  trafficSpeed: 9,
  policeSpeed: 30,
  playerMaxHealth: 100,
  carMaxHealth: 100,
  shotCooldown: 0.22,
  shotDamage: 34,
  punchDamage: 20,
  wantedDecaySeconds: 9,
};

export const SAVE_KEY = 'solmar-bay-save-v1';
export const MONEY_START = 250;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

// Deterministic random stream so the city, traffic and pedestrians look the same
// on every load (screenshots included) unless a seed is given in the URL.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Distance from a point to the nearest street centre line (roads run both ways).
export function distanceToStreet(x, z) {
  let best = Infinity;
  for (const s of CITY.streets) {
    best = Math.min(best, Math.abs(x - s), Math.abs(z - s));
  }
  return best;
}

export function isOnRoad(x, z) {
  return distanceToStreet(x, z) <= CITY.roadHalf + 1;
}

export function nearestStreetCoord(v) {
  let best = CITY.streets[0];
  for (const s of CITY.streets) if (Math.abs(v - s) < Math.abs(best - v)) best = s;
  return best;
}

export function formatCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
}
