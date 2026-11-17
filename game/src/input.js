// Solmar Bay keyboard + mouse input. Held keys give movement axes; one-shot
// presses (enter car, punch, pause, shoot) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_ENTER_CAR = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_TAXI = 8;
export const ACTION_MUTE = 16;
export const ACTION_CONFIRM = 32;
export const ACTION_HORN = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let shootQueued = false;
  let dragYaw = 0;
  let dragPitch = 0;
  let wheelDelta = 0;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyT') actions |= ACTION_TAXI;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    shootQueued = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    dragYaw -= (event.clientX - lastX) * 0.005;
    dragPitch += (event.clientY - lastY) * 0.004;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('wheel', (event) => {
    wheelDelta += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  return {
    key(code) { return keys.has(code); },
    // -1..1 forward/back and strafe axes, camera-relative (WASD + arrows).
    moveAxes() {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { fwd, strafe };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    jump() { return keys.has('Space'); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // True once per click; held mouse keeps firing through shootHeld().
    takeShoot() {
      const s = shootQueued;
      shootQueued = false;
      return s;
    },
    shootHeld() { return mouseDown; },
    takeCameraDrag() {
      const d = { yaw: dragYaw, pitch: dragPitch };
      dragYaw = 0;
      dragPitch = 0;
      return d;
    },
    takeWheel() {
      const w = wheelDelta;
      wheelDelta = 0;
      return w;
    },
  };
}
