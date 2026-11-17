// Solmar Bay procedural textures: every building face, road, beach and sign is
// painted on a canvas at load time, so the game ships no image files at all.
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// A sun-soaked building facade: warm plaster, lit windows, a darker base floor
// and a roofline. The palette changes per district so the city reads as varied.
export function makeBuildingTexture(base, trim, litRatio, random) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so flat boxes still read as volumes.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // Window grid.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 10 + col * 22;
      const y = 14 + row * 23;
      const lit = random() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#20242e';
      g.fillRect(x, y, 14, 16);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x, y, 14, 3);
    }
  }
  // Ground floor: shopfronts and a door.
  g.fillStyle = trim;
  g.fillRect(0, 232, 128, 24);
  g.fillStyle = '#1b1e26';
  g.fillRect(56, 238, 16, 18);
  g.fillStyle = '#7ee0d2';
  g.fillRect(12, 238, 34, 12);
  g.fillRect(82, 238, 34, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Asphalt with a dashed centre line and edge lines; repeats along the road.
export function makeRoadTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f36';
  g.fillRect(0, 0, 128, 128);
  // Speckle.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#e8c33a';
  g.fillRect(62, 8, 4, 40);
  g.fillRect(62, 80, 4, 40);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(4, 0, 3, 128);
  g.fillRect(121, 0, 3, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSidewalkTexture() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#9a938a';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 62, 62);
  g.beginPath();
  g.moveTo(32, 0);
  g.lineTo(32, 64);
  g.moveTo(0, 32);
  g.lineTo(64, 32);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSandTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#e8cf9a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(180,140,80,0.35)' : 'rgba(255,240,200,0.4)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A bright shop / district sign painted on a canvas, used as a billboard texture.
export function makeSignTexture(text, bg, fg) {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
