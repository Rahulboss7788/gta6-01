// Solmar Bay saves: cash, story progress, coins and where Dario was standing,
// kept in this browser's localStorage so a visit can be continued later.
import { SAVE_KEY } from './config.js';

export function saveGame(state, player, missions) {
  try {
    const pos = player.onFoot
      ? { x: player.x, z: player.z }
      : { x: player.car.x, z: player.car.z };
    const data = {
      cash: state.cash,
      missionIndex: missions.index,
      coinsCollected: state.coinsCollected || 0,
      shotsFired: state.shotsFired || 0,
      x: pos.x,
      z: pos.z,
      time: state.minutes,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
