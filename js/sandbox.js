/* sandbox.js — the mining hall of the Kaan cruiser.
   Rows of mining towers (OpenHuman's Tripo server rack, instanced and stacked up to three high) face two aisles; seven
   OpenHuman tiny humans walk the hall with tools (Tripo drill + tool set), service their towers, haul crates of new rigs
   to the build bay and stack them; the onboard AI patrols. Every share they announce is a real double SHA-256 result
   from the miner worker, on the live Bitcoin tip. The window is Webb's Cosmic Cliffs. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { chain, bus, wallet, vault, rig, RELEASE_HEIGHT, DRIP, eraFactor, release, fmt, ubtc, short, blockUrl } from './core.js';

const $ = (s, r) => (r || document).querySelector(s);
const MOBILE = matchMedia('(max-width: 900px)').matches;
const stage = $('#stage'), overlay = $('#overlay');
const ACC = 0xf7a541;

/* ───────── renderer ───────── */
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 2 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03040a);
scene.fog = new THREE.Fog(0x05070e, 34, 64);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);

/* ───────── the hall ───────── */
const ROOM = { x0: -14, x1: 14, z0: -11.5, z1: 4, wallH: 10 };
const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, ZM = (ROOM.z0 + ROOM.z1) / 2;
const metal = (c, r = 0.55, m = 0.35) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), metal(0x1a202c, 0.42, 0.25));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ZM); floor.receiveShadow = true; scene.add(floor);
const flat = (w, d, x, z, mat, y = 0.004) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); return m; };
// deck plating seams and the orange safety lines that mark the two aisles and the front lane
const seam = new THREE.MeshBasicMaterial({ color: 0x05070c }), safety = new THREE.MeshBasicMaterial({ color: 0xc98a3a });
for (let x = ROOM.x0 + 2; x < ROOM.x1; x += 2) flat(0.025, D, x, ZM, seam, 0.002);
for (let z = ROOM.z0 + 2; z < ROOM.z1; z += 2) flat(W, 0.025, 0, z, seam, 0.002);
for (const x of [-5.6, -1.4, 1.4, 5.6]) flat(0.06, 7.6, x, -6.2, safety);
flat(W - 4, 0.06, 0, -1.9, safety); flat(W - 4, 0.06, 0, 2.9, safety);

// back wall: one long window onto the Carina Nebula, the towers stand against it
const WIN = { x0: -12.5, x1: 12.5, y0: 1.2, y1: 9.2 };
const wallMat = metal(0x0c1019);
function wallPiece(w, h, x, y) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, ROOM.z0); scene.add(m); }
wallPiece(WIN.x0 - ROOM.x0, ROOM.wallH, (ROOM.x0 + WIN.x0) / 2, ROOM.wallH / 2);
wallPiece(ROOM.x1 - WIN.x1, ROOM.wallH, (WIN.x1 + ROOM.x1) / 2, ROOM.wallH / 2);
wallPiece(WIN.x1 - WIN.x0, WIN.y0, 0, WIN.y0 / 2);
wallPiece(WIN.x1 - WIN.x0, ROOM.wallH - WIN.y1, 0, (WIN.y1 + ROOM.wallH) / 2);
const texL = new THREE.TextureLoader();
const space = texL.load('img/carina.jpg'); space.colorSpace = THREE.SRGBColorSpace;
const winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0;
const view = new THREE.Mesh(new THREE.PlaneGeometry(winW * 1.35, winW * 1.35 * 1111 / 1920), new THREE.MeshBasicMaterial({ map: space, color: 0xd6dcea, fog: false }));
view.position.set(0, (WIN.y0 + WIN.y1) / 2 - 1.2, ROOM.z0 - 4); scene.add(view);
const frameMat = metal(0x07090f);
for (let i = 0; i <= 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, winH, 0.18), frameMat); m.position.set(WIN.x0 + i * winW / 8, (WIN.y0 + WIN.y1) / 2, ROOM.z0); scene.add(m); }
for (const y of [WIN.y0, WIN.y1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.14, 0.16, 0.2), frameMat); m.position.set(0, y, ROOM.z0); scene.add(m); }
const sideL = new THREE.Mesh(new THREE.PlaneGeometry(D, ROOM.wallH), wallMat); sideL.rotation.y = Math.PI / 2; sideL.position.set(ROOM.x0, ROOM.wallH / 2, ZM); scene.add(sideL);
const sideR = sideL.clone(); sideR.rotation.y = -Math.PI / 2; sideR.position.x = ROOM.x1; scene.add(sideR);
// overhead cable trays running down each aisle
const trayMat = metal(0x141924, 0.6, 0.5);
for (const x of [-3.5, 3.5]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 9), trayMat); t.position.set(x, 8.6, -6.3); scene.add(t); }

/* ───────── light ───────── */
scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1712, 1.15));
const sun = new THREE.DirectionalLight(0xffe6cc, 1.7); sun.position.set(4, 16, 12); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); sun.shadow.bias = -0.0005; scene.add(sun); scene.add(sun.target);
const nebula = new THREE.PointLight(0xf0a86a, 14, 22); nebula.position.set(0, 5, -10); scene.add(nebula);
for (const x of [-3.5, 3.5]) {   // cool aisle light + a warm work light at each aisle mouth
  const a = new THREE.PointLight(0x4a8fd8, 10, 13); a.position.set(x, 6.5, -6.5); scene.add(a);
  const b = new THREE.PointLight(0xffc27a, 5, 9); b.position.set(x, 4, -2.2); scene.add(b);
}
const front = new THREE.PointLight(0xaabbff, 7, 22); front.position.set(0, 6, 3); scene.add(front);
for (const x of [-9, 9]) { const l = new THREE.PointLight(0xffc27a, 6, 10); l.position.set(x, 3.5, 1.2); scene.add(l); }   // work lights over the bench and the crates

/* ───────── models ───────── */
const loader = new GLTFLoader();
const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
function prep(root) {
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; const m = o.material; if (!m) return;
    m.metalness = 0; if (m.metalnessMap) { m.metalnessMap.dispose(); m.metalnessMap = null; } if (m.roughnessMap) { m.roughnessMap.dispose(); m.roughnessMap = null; }
    if (MOBILE && m.normalMap) { m.normalMap.dispose(); m.normalMap = null; } m.roughness = Math.max(0.5, m.roughness || 0.8); m.needsUpdate = true;
  });
  return root;
}
function fit(obj, size, mode) {
  const b = new THREE.Box3().setFromObject(obj); const d = b.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(size / (mode === 'w' ? Math.max(d.x, d.z) : d.y));
  const b2 = new THREE.Box3().setFromObject(obj); const c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z)); return new THREE.Box3().setFromObject(obj);
}
const MODELS = {};
async function loadModels() {
  const names = ['mascot', 'rack', 'drill', 'tools', 'crate', 'workbench'];
  const res = await Promise.allSettled(names.map(n => load(`models/${n}.glb`)));
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') MODELS[names[i]] = prep(r.value);
    else { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), metal(0x222833))); MODELS[names[i]] = g; logLine('hall', `models/${names[i]}.glb missing`, 'warn'); }
  });
}

/* ───────── towers ───────── */
const RACK_H = 2.55;
let RACK = { w: 1, d: 1 };
const ROWS = [   // x of the row and which way its fronts face (+1 = +x)
  { x: -7.4, face: 1 }, { x: -0.85, face: -1 }, { x: 0.85, face: 1 }, { x: 7.4, face: -1 },
];
const ROW_Z0 = -10.2, ROW_Z1 = -2.6;
const towers = [];   // {row, slot, x, z, face, levels, stand:{x,z,heading}, screen?}
let LEDS = null;
function buildTowers() {
  // one instanced rack: every tower level in the hall is a single draw
  const src = MODELS.rack.clone(true); const bb = fit(src, RACK_H, 'h'); const size = bb.getSize(new THREE.Vector3());
  RACK = { w: size.x, d: size.z };
  let mesh = null; src.updateMatrixWorld(true); src.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const slots = Math.floor((ROW_Z1 - ROW_Z0) / (RACK.w + 0.06));
  const pattern = [3, 3, 2, 3, 3, 3, 2, 3, 3];
  const list = [];
  ROWS.forEach((row, ri) => {
    for (let s = 0; s < slots; s++) {
      const z = ROW_Z0 + RACK.w / 2 + s * (RACK.w + 0.06);
      const levels = pattern[(s + ri * 2) % pattern.length];
      const t = { row: ri, slot: s, x: row.x, z, face: row.face, levels, stand: { x: row.x + row.face * (RACK.d / 2 + 0.75), z, heading: row.face > 0 ? -Math.PI / 2 : Math.PI / 2 } };
      towers.push(t); for (let l = 0; l < levels; l++) list.push({ x: row.x, y: l * RACK_H, z, ry: row.face > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  });
  const inst = new THREE.InstancedMesh(geo, mesh.material, list.length); inst.castShadow = inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  list.forEach((p, i) => { q.setFromAxisAngle(up, p.ry); m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, one); inst.setMatrixAt(i, m4); });
  scene.add(inst);
  // status LEDs: three thin lit strips across the front of every rack level, one instanced draw, blinking
  const ledGeo = new THREE.BoxGeometry(0.02, 0.05, RACK.w * 0.62);
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), list.length * 3);
  let k = 0; const col = new THREE.Color();
  list.forEach(p => {
    const fx = p.x + Math.sign(Math.sin(p.ry)) * (RACK.d / 2 + 0.012);
    for (let j = 0; j < 3; j++) { m4.makeTranslation(fx, p.y + RACK_H * (0.25 + j * 0.25), p.z); leds.setMatrixAt(k, m4); leds.setColorAt(k, col.set(j === 1 ? ACC : 0x3a86ff)); k++; }
  });
  scene.add(leds); LEDS = leds;
}
function blinkLeds() {
  if (!LEDS) return; const c = new THREE.Color();
  for (let i = 0; i < 18; i++) { const k = Math.floor(Math.random() * LEDS.count); const r = Math.random(); LEDS.setColorAt(k, c.set(r < 0.55 ? 0x3a86ff : r < 0.9 ? ACC : 0x0a1220)); }
  LEDS.instanceColor.needsUpdate = true;
}

/* tower status screens (only on the towers someone looks after) */
const C = { acc: '#f7a541', ink: '#dfe6ee', ink2: '#9aa7b8', ink3: '#4f5a6c', ok: '#6fe8a8', bg: '#05070e', grid: '#1a2030' };
const MONO = 'IBM Plex Mono, ui-monospace, monospace';
function makeScreen(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return { cv, ctx: cv.getContext('2d'), tex }; }
function towerScreen(t) {
  const s = makeScreen(320, 200); const p = new THREE.Mesh(new THREE.PlaneGeometry(RACK.w * 0.86, RACK.w * 0.86 * 200 / 320), new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false }));
  p.position.set(t.x + t.face * (RACK.d / 2 + 0.03), RACK_H + 0.9, t.z); p.rotation.y = t.face > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(p);
  t.screen = s; return s;
}
function zeroText(ctx, h, x, y, maxCh) {
  const m = /^0*/.exec(h)[0]; const s = h.slice(0, maxCh);
  ctx.fillStyle = C.acc; ctx.fillText(s.slice(0, m.length), x, y);
  const w = ctx.measureText(s.slice(0, m.length)).width; ctx.fillStyle = C.ink3; ctx.fillText(s.slice(m.length), x + w, y);
}
const rateTxt = r => !r ? '—' : r >= 1e6 ? (r / 1e6).toFixed(2) + ' MH/s' : (r / 1e3).toFixed(1) + ' kH/s';
const ago = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : (s / 3600).toFixed(1) + 'h'; };
const tName = t => 'T-' + String(t.row * 10 + t.slot).padStart(2, '0');
function drawTower(h) {
  const t = h.tower; if (!t || !t.screen) return; const { ctx, cv } = t.screen; const st = h.stat || {};
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = h.flash && performance.now() - h.flash < 1500 ? C.acc : C.grid; ctx.fillRect(0, 0, cv.width, 4);
  ctx.font = `600 22px ${MONO}`; ctx.fillStyle = h.you ? C.acc : C.ink; ctx.fillText(h.you ? (h.hidden ? tName(t) + ' · FREE' : 'YOUR TOWER') : tName(t) + ' · ' + h.label, 14, 34);
  ctx.font = `500 17px ${MONO}`; ctx.fillStyle = C.ink2; ctx.fillText((h.idle ? 'idle' : rateTxt(st.rate)) + '  ·  ' + (h.shares || 0) + ' shares', 14, 66);
  ctx.fillStyle = C.ink3; ctx.fillText('target ' + (st.bits ? st.bits + ' bits' : '—') + (h.bestZ ? '  best ' + h.bestZ : ''), 14, 92);
  ctx.font = `500 16px ${MONO}`;
  (h.hashes || []).slice(-4).reverse().forEach((x, i) => zeroText(ctx, x, 14, 122 + i * 20, 26));
  t.screen.tex.needsUpdate = true;
}

/* ───────── front zone: workbench, crates, build bay, faucet screen ───────── */
const BENCH = { x: -10.2, z: 1.0 }, CRATES = { x: 10.4, z: 0.6 }, BAY = { x: 0, z: -0.6, levels: 0, racks: [] };
function place(name, size, mode, x, z, ry = 0, y = 0) { const o = MODELS[name].clone(true); fit(o, size, mode); const g = new THREE.Group(); g.add(o); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; }
function buildFront() {
  place('workbench', 2.2, 'w', BENCH.x, BENCH.z - 0.6, Math.PI / 2);
  place('tools', 0.7, 'w', BENCH.x + 0.1, BENCH.z - 0.5, 0.6, 0.98);
  for (const [dx, dz, dy, r] of [[0, 0, 0, 0.1], [1.0, 0.1, 0, -0.2], [0.5, -0.9, 0, 0.4], [0.1, 0.05, 0.92, 0.5], [0.95, 0, 0.92, 0], [0.5, -0.85, 0.92, -0.3], [0.5, -0.4, 1.84, 0.2]]) place('crate', 0.95, 'w', CRATES.x + dx - 0.5, CRATES.z + dz, r, dy);
  // the build bay: a floor plate where hauled crates become a new tower, level by level
  flat(RACK.d + 0.6, RACK.w + 0.6, BAY.x, BAY.z, new THREE.MeshBasicMaterial({ color: 0x1a1408 }), 0.006);
  for (const [w, d, x, z] of [[RACK.d + 0.6, 0.05, 0, -(RACK.w + 0.6) / 2], [RACK.d + 0.6, 0.05, 0, (RACK.w + 0.6) / 2], [0.05, RACK.w + 0.6, -(RACK.d + 0.6) / 2, 0], [0.05, RACK.w + 0.6, (RACK.d + 0.6) / 2, 0]]) flat(w, d, BAY.x + x, BAY.z + z, safety, 0.008);
}
function bayAdd() {
  const o = MODELS.rack.clone(true); fit(o, RACK_H, 'h'); const g = new THREE.Group(); g.add(o); g.position.set(BAY.x, BAY.levels * RACK_H + 3, BAY.z); scene.add(g);
  BAY.racks.push({ g, y: BAY.levels * RACK_H, t: 0 }); BAY.levels++;
  if (BAY.levels >= 3) setTimeout(() => {
    logLine('hall', 'build bay: the new tower is cabled and hashing · clearing the bay for the next one', 'blk');
    BAY.racks.forEach(r => scene.remove(r.g)); BAY.racks = []; BAY.levels = 0;
  }, 9000);
}
function updateBay(dt) { for (const r of BAY.racks) { if (r.t >= 1) continue; r.t = Math.min(1, r.t + dt / 0.9); const e = 1 - Math.pow(1 - r.t, 3); r.g.position.y = r.y + (1 - e) * 3; } }

const SCR = { w: 6.0, h: 3.36, x: -9.6, y: 5.6, z: -0.6, ry: 0.42 };
const scrCv = document.createElement('canvas'); scrCv.width = 1024; scrCv.height = 574;
const scrTex = new THREE.CanvasTexture(scrCv); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 4;
const scrG = new THREE.Group(); scrG.position.set(SCR.x, SCR.y, SCR.z); scrG.rotation.y = SCR.ry; scene.add(scrG);
scrG.add(new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })));
const scrBack = new THREE.Mesh(new THREE.BoxGeometry(SCR.w + 0.2, SCR.h + 0.2, 0.08), metal(0x05060a)); scrBack.position.z = -0.06; scrG.add(scrBack);
for (const dx of [-SCR.w / 3, SCR.w / 3]) { const len = ROOM.wallH - SCR.y - SCR.h / 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len), metal(0x222831)); c.position.set(dx, SCR.h / 2 + len / 2, -0.05); scrG.add(c); }
const SCR_WORLD = new THREE.Vector3(SCR.x, SCR.y - 0.6, SCR.z);

const deckShares = []; let shareCount = 0;
function drawWall() {
  const ctx = scrCv.getContext('2d'), cw = scrCv.width, t = chain.tip;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, scrCv.height);
  ctx.font = `500 20px ${MONO}`; ctx.fillStyle = C.ink3; ctx.fillText('KAAN CRUISER · MINING HALL · uBTC FAUCET', 30, 44);
  ctx.textAlign = 'right'; ctx.fillStyle = chain.status === 'live' ? C.ok : C.ink3; ctx.fillText(chain.status === 'live' ? '● LIVE BITCOIN' : '○ ' + chain.status.toUpperCase(), cw - 30, 44); ctx.textAlign = 'left';
  if (t) {
    ctx.font = `500 18px ${MONO}`; ctx.fillStyle = C.ink2; ctx.fillText('BITCOIN TIP', 30, 96);
    ctx.font = `600 70px ${MONO}`; ctx.fillStyle = C.ink; ctx.fillText('#' + fmt(t.height), 30, 166);
    ctx.font = `500 17px ${MONO}`; ctx.fillStyle = C.ink3; ctx.fillText(`${ago(t.time)} ago${t.pool ? ' · ' + t.pool : ''} · ${fmt(t.txs || 0)} txs`, 30, 200);
    zeroText(ctx, t.hash, 30, 230, 40);
    const k = eraFactor(t.height), r = release(t.height);
    ctx.font = `500 18px ${MONO}`; ctx.fillStyle = C.ink2; ctx.fillText('DRIP OPEN', 580, 96);
    ctx.font = `600 58px ${MONO}`; ctx.fillStyle = C.acc; ctx.fillText(fmt(DRIP * k), 580, 160);
    ctx.font = `500 18px ${MONO}`; ctx.fillStyle = C.ink3; ctx.fillText('uBTC · container A', 580, 192);
    ctx.fillStyle = C.ink2; ctx.fillText('RELEASE #' + fmt(RELEASE_HEIGHT), 580, 230);
    ctx.fillStyle = C.ink; ctx.fillText(fmt(r.left) + ' blocks', 580, 256);
  }
  ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(30, 282); ctx.lineTo(cw - 30, 282); ctx.stroke();
  ctx.font = `500 17px ${MONO}`; ctx.fillStyle = C.ink2; ctx.fillText(`HALL SHARES · ${fmt(shareCount)} since boot · build bay ${BAY.levels}/3`, 30, 316);
  ctx.font = `500 18px ${MONO}`;
  deckShares.slice(0, 9).forEach((s, i) => {
    const y = 348 + i * 24; ctx.fillStyle = C.ink3; ctx.fillText(ago(s.t / 1000).padStart(4), 30, y);
    ctx.fillStyle = s.you ? C.acc : C.ink; ctx.fillText(s.name.slice(0, 12), 100, y);
    zeroText(ctx, s.hash, 270, y, 34);
    ctx.textAlign = 'right'; ctx.fillStyle = C.acc; ctx.fillText(s.zeros + 'b', cw - 30, y); ctx.textAlign = 'left';
  });
  scrTex.needsUpdate = true;
}

/* ───────── humans ───────── */
const AGENTS = [
  { name: 'GENESIS', note: 'block 0', tower: [0, 1] }, { name: 'BLOCK-170', note: 'first payment', tower: [1, 3] }, { name: 'PIZZA', note: '10,000 BTC', tower: [0, 4] },
  { name: 'FAUCET-5', note: 'the first faucet', tower: [2, 1] }, { name: 'BITS', note: 'BIP 176', tower: [3, 0] }, { name: 'MERKLE', note: 'the root', tower: [3, 3] }, { name: 'NONCE', note: '32 bits at a time', tower: [1, 0] },
];
const YOU_TOWER = [2, 99];   // the front-most tower of the right aisle's left row
const SIZE = { human: 1.7, ai: 2.0 };
const humans = [];
const LANE_Z = 1.2;   // the front lane every cross-hall route passes through
function makeHuman(spec) {
  const root = new THREE.Group(), body = new THREE.Group();
  const model = MODELS.mascot.clone(true); const bb = fit(model, spec.ai ? SIZE.ai : SIZE.human, 'h'); body.add(model); root.add(body);
  root.position.set(spec.x, 0, spec.z); scene.add(root);
  const hand = new THREE.Group(); hand.position.set(0.55, bb.max.y * 0.45, 0.22); body.add(hand);
  const head = new THREE.Group(); head.position.set(0, bb.max.y + 0.05, 0); body.add(head);
  const tag = document.createElement('div'); tag.className = 'tag3'; overlay.appendChild(tag);
  const nameEl = document.createElement('div'); nameEl.className = 'name3' + (spec.ai ? ' ai' : '') + (spec.you ? ' you' : ''); nameEl.textContent = spec.label; overlay.appendChild(nameEl);
  const h = { ...spec, root, body, hand, head, tag, nameEl, state: 'idle', task: null, path: [], phase: Math.random() * 6, move: null, moveT: 0, heading: 0, headY: bb.max.y, hashes: [], shares: 0, tool: null, carry: null };
  humans.push(h); return h;
}
function holdTool(h, name) {
  if (h.tool) { h.hand.remove(h.tool); h.tool = null; } h.toolName = name; if (!name) return;
  const o = MODELS[name].clone(true); fit(o, name === 'drill' ? 0.6 : 0.62, 'w'); const g = new THREE.Group(); g.add(o);
  if (name === 'drill') g.rotation.y = -Math.PI / 2; else g.rotation.set(Math.PI / 2.6, 0, 0);
  h.hand.add(g); h.tool = g;
}
function carryCrate(h, on) {
  if (h.carry) { h.head.remove(h.carry); h.carry = null; } if (!on) return;
  const o = MODELS.crate.clone(true); fit(o, 0.8, 'w'); const g = new THREE.Group(); g.add(o); g.position.y = 0.05; h.head.add(g); h.carry = g;
}
function showTag(h, text, cls) { h.tag.textContent = text; h.tag.className = 'tag3 on ' + (cls || ''); clearTimeout(h.tagT); h.tagT = setTimeout(() => (h.tag.className = 'tag3'), 4500); }
const react = (h, move) => { h.move = move; h.moveT = 0; };
const inHall = z => z < -1.6;
// walk through the front lane unless both ends are in the same aisle
function route(h, x, z) {
  const p = h.root.position; const pts = [];
  const sameAisle = inHall(p.z) && inHall(z) && Math.abs(p.x - x) < 1.2;
  if (!sameAisle) {
    if (inHall(p.z)) pts.push(new THREE.Vector3(p.x, 0, LANE_Z - 0.4));
    if (inHall(z)) pts.push(new THREE.Vector3(x, 0, LANE_Z - 0.4));
  }
  pts.push(new THREE.Vector3(x, 0, z)); h.path = pts; h.state = 'walk';
}

/* tasks: service your tower with a tool, haul a crate to the build bay, or swap tools at the bench */
function nextTask(h) {
  if (h.ai) return aiTask(h);
  if (h.you) {
    if (!h.idle) { holdTool(h, 'tools'); h.task = 'service'; route(h, h.tower.stand.x, h.tower.stand.z); }
    else { holdTool(h, null); h.task = 'wait'; route(h, h.tower.stand.x + h.tower.face * 0.4, -0.9); }
    return;
  }
  const r = Math.random();
  if (r < 0.58) { h.task = 'service'; holdTool(h, Math.random() < 0.6 ? 'drill' : 'tools'); route(h, h.tower.stand.x, h.tower.stand.z + (Math.random() - 0.5) * 0.3); }
  else if (r < 0.86 && BAY.levels < 3 && !humans.some(o => o !== h && (o.task === 'fetch' || o.task === 'haul'))) { h.task = 'fetch'; holdTool(h, null); route(h, CRATES.x - 1.4, CRATES.z + (Math.random() - 0.5) * 0.8); }
  else { h.task = 'bench'; route(h, BENCH.x + 1.3, BENCH.z + (Math.random() - 0.5) * 0.6); }
}
function arrive(h) {
  const T = performance.now() / 1000;
  if (h.task === 'service') { h.state = 'work'; h.workUntil = T + 7 + Math.random() * 7; h.heading = h.tower.stand.heading; if (Math.random() < 0.35 && !h.you) logLine(h.label, `${h.toolName === 'drill' ? 'drills a fan mount on' : 'reseats the boards in'} ${tName(h.tower)}`); }
  else if (h.task === 'fetch') { carryCrate(h, true); h.carrying = true; h.task = 'haul'; route(h, BAY.x + 1.25, BAY.z + 0.1); }
  else if (h.task === 'haul') { h.state = 'work'; h.workUntil = T + 2.2; h.heading = -Math.PI / 2; }
  else if (h.task === 'bench') { h.state = 'work'; h.workUntil = T + 3.5 + Math.random() * 3; h.heading = -Math.PI / 2; }
  else { h.state = 'idle'; h.workUntil = T + 2 + Math.random() * 3; h.heading = 0; }
}
function finish(h) {
  if (h.task === 'haul') {
    carryCrate(h, false); h.carrying = false;
    if (BAY.levels < 3) { bayAdd(); logLine(h.label, `installs a new rig in the build bay · ${BAY.levels}/3`, 'gain'); showTag(h, `rig installed · ${BAY.levels}/3`, 'up'); }
  }
  if (h.task === 'bench') holdTool(h, Math.random() < 0.5 ? 'drill' : 'tools');
  h.state = 'idle'; h.task = null; nextTask(h);
}
function aiTask(h) {
  if (h.busy) return; h.task = 'patrol';
  const picks = [[-3.5, -3 - Math.random() * 6], [3.5, -3 - Math.random() * 6], [(Math.random() - 0.5) * 16, LANE_Z], [BAY.x - 1.3, BAY.z]];
  const p = picks[Math.floor(Math.random() * picks.length)]; route(h, p[0], p[1]);
}

/* drill sparks */
const SPN = 240; const spPos = new Float32Array(SPN * 3).map((_, i) => (i % 3 === 1 ? -500 : 0)), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc070, size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparkPts.frustumCulled = false; scene.add(sparkPts);
let spI = 0; const tmpV = new THREE.Vector3();
function emitSparks(p, n) { for (let i = 0; i < n; i++) { const k = spI++ % SPN; spPos[k * 3] = p.x; spPos[k * 3 + 1] = p.y; spPos[k * 3 + 2] = p.z; spVel[k * 3] = (Math.random() - 0.5) * 2.4; spVel[k * 3 + 1] = Math.random() * 2.2; spVel[k * 3 + 2] = (Math.random() - 0.5) * 2.4; spLife[k] = 0.4 + Math.random() * 0.4; } }
function updateSparks(dt) { for (let k = 0; k < SPN; k++) { if (spLife[k] <= 0) { spPos[k * 3] = 0; spPos[k * 3 + 1] = -500; spPos[k * 3 + 2] = 0; continue; } spLife[k] -= dt; spVel[k * 3 + 1] -= 6 * dt; spPos[k * 3] += spVel[k * 3] * dt; spPos[k * 3 + 1] += spVel[k * 3 + 1] * dt; spPos[k * 3 + 2] += spVel[k * 3 + 2] * dt; } sparkGeo.attributes.position.needsUpdate = true; }

function updateHuman(h, dt, now) {
  const r = h.root, b = h.body; let speed = 0;
  r.visible = !h.hidden; if (h.hidden) return;
  if (h.state === 'walk' && h.path.length) {
    const tgt = h.path[0]; const d = tgt.clone().sub(r.position); d.y = 0; const dist = d.length();
    if (dist < 0.08) { r.position.copy(tgt); h.path.shift(); if (!h.path.length) arrive(h); }
    else { speed = h.carrying ? 1.25 : 1.6; d.normalize(); r.position.addScaledVector(d, Math.min(dist, speed * dt)); h.heading = Math.atan2(d.x, d.z); }
  } else if (h.state === 'work' || h.state === 'idle') {
    if (h.workUntil && now > h.workUntil) { h.workUntil = 0; finish(h); }
    else if (!h.workUntil && h.state === 'idle' && !h.busy) nextTask(h);
  }
  let dy = h.heading - r.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.rotation.y += dy * Math.min(1, dt * 8);
  let y = 0, roll = 0, pitch = 0, sy = 1, yaw = 0;
  if (speed > 0) { h.phase += dt * speed * 5.6; const s = Math.sin(h.phase); y = Math.abs(s) * 0.07; roll = s * 0.14; pitch = h.carrying ? -0.04 : 0.07; sy = 1 - 0.045 * Math.pow(1 - Math.abs(s), 3); }
  else if (h.move) {
    h.moveT += dt; const k = h.moveT;
    if (h.move === 'cheer') { const hh = Math.abs(Math.sin(k * 5.2)) * Math.max(0, 1 - k / 3.4); y = hh * 0.42; sy = 1 + hh * 0.12; yaw = k < 1.2 ? k / 1.2 * Math.PI * 2 : 0; }
    else if (h.move === 'worried') { sy = 0.93; pitch = 0.16; roll = Math.sin(k * 14) * 0.06; }
    else if (h.move === 'point') { pitch = -0.12; roll = Math.sin(k * 3) * 0.08; y = Math.abs(Math.sin(k * 2.5)) * 0.05; }
    if (k > 3.6) h.move = null;
  } else if (h.state === 'work') {
    if (h.task === 'service' || h.task === 'bench') {
      pitch = 0.14; y = Math.abs(Math.sin(now * 11 + h.phase)) * 0.025; sy = 1 + Math.sin(now * 22) * 0.01;
      if (h.tool) { h.tool.position.x = Math.sin(now * 40) * 0.015; h.tool.rotation.z = Math.sin(now * 9) * 0.25; }
      if (h.toolName === 'drill' && Math.random() < dt * 9) { h.hand.getWorldPosition(tmpV); tmpV.x += Math.sin(r.rotation.y) * 0.45; tmpV.z += Math.cos(r.rotation.y) * 0.45; emitSparks(tmpV, 3); }
    } else { pitch = 0.3; sy = 0.96; }   // setting a crate down
  } else {
    sy = 1 + Math.sin(now * 1.9 + h.phase) * 0.012; yaw = Math.sin(now * 0.45 + h.phase * 3) * 0.22;
  }
  const e = Math.min(1, dt * 14);
  b.position.y += (y - b.position.y) * e; b.rotation.z += (roll - b.rotation.z) * e; b.rotation.x += (pitch - b.rotation.x) * e; b.rotation.y = yaw;
  b.scale.y += (sy - b.scale.y) * e; b.scale.x = b.scale.z = 1 + (1 - b.scale.y) * 0.6;
}

/* ───────── drips: a coin of light flies from a tower to the faucet screen ───────── */
const coins = []; const coinGeo = new THREE.SphereGeometry(0.1, 12, 8);
function flyCoin(from, you) {
  const m = new THREE.Mesh(coinGeo, new THREE.MeshBasicMaterial({ color: you ? 0xffd08a : ACC, transparent: true, toneMapped: false }));
  m.position.copy(from); scene.add(m);
  coins.push({ m, a: from.clone(), b: SCR_WORLD.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, 0.3)), t: 0 });
}
function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]; c.t += dt / 1.8; const k = Math.min(1, c.t), e = k * k * (3 - 2 * k);
    c.m.position.lerpVectors(c.a, c.b, e); c.m.position.y += Math.sin(k * Math.PI) * 3; c.m.material.opacity = 1 - Math.max(0, k - 0.85) / 0.15;
    if (k >= 1) { scene.remove(c.m); c.m.material.dispose(); coins.splice(i, 1); }
  }
}

/* ───────── camera ───────── */
const cam = { az: 0, el: MOBILE ? 0.62 : 0.5, target: new THREE.Vector3(0, 1.8, -4.0) };
let drag = null, userZoom = 1;
const corners = [];
for (const x of MOBILE ? [-8.6, 8.6] : [-12.6, 12.6]) { corners.push(new THREE.Vector3(x, 8.2, ROOM.z0 + 1.5)); corners.push(new THREE.Vector3(x, 0, 2.4)); corners.push(new THREE.Vector3(x, 1.5, 2.4)); }
const probe = new THREE.Vector3();
function placeCam(t, d) { camera.position.set(t.x + d * Math.sin(cam.az) * Math.cos(cam.el), t.y + d * Math.sin(cam.el), t.z + d * Math.cos(cam.az) * Math.cos(cam.el)); camera.lookAt(t); }
function fitDistance(t) { let lo = 4, hi = 90; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; placeCam(t, mid); const ok = corners.every(c => { probe.copy(c).project(camera); return Math.abs(probe.x) < 0.98 && Math.abs(probe.y) < 0.94; }); if (ok) hi = mid; else lo = mid; } return hi; }
function frame() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(frame).observe(stage); frame();
stage.addEventListener('pointerdown', e => { if (e.target.closest('.hud')) return; drag = { x: e.clientX, y: e.clientY, az: cam.az, el: cam.el, moved: 0 }; });
addEventListener('pointermove', e => { if (!drag) return; drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y)); if (drag.moved < 5) return; cam.az = THREE.MathUtils.clamp(drag.az - (e.clientX - drag.x) * 0.006, -1.0, 1.0); cam.el = THREE.MathUtils.clamp(drag.el + (e.clientY - drag.y) * 0.004, 0.15, 1.25); });
addEventListener('pointerup', () => (drag = null)); addEventListener('pointercancel', () => (drag = null));
stage.addEventListener('wheel', e => { if (!e.ctrlKey && !e.shiftKey) return; e.preventDefault(); userZoom = THREE.MathUtils.clamp(userZoom * (1 + e.deltaY * 0.001), 0.4, 1.3); }, { passive: false });
$('#zoomIn').addEventListener('click', () => (userZoom = Math.max(0.4, userZoom * 0.85)));
$('#zoomOut').addEventListener('click', () => (userZoom = Math.min(1.3, userZoom * 1.18)));
const v3 = new THREE.Vector3();
function placeLabels() {
  const w = stage.clientWidth, hh = stage.clientHeight;
  for (const h of humans) {
    v3.set(h.root.position.x, h.headY + 0.25 + h.body.position.y + (h.carry ? 0.85 : 0), h.root.position.z).project(camera);
    const x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * hh, vis = !h.hidden && v3.z < 1;
    h.tag.style.transform = `translate(${x}px,${y - 26}px) translate(-50%,-100%)`; h.nameEl.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    h.tag.style.visibility = h.nameEl.style.visibility = vis ? 'visible' : 'hidden';
  }
}

/* ───────── log ───────── */
const log = $('#log'); const hhmmss = () => new Date().toTimeString().slice(0, 8);
function logLine(who, msg, cls) {
  if (!log) return; const li = document.createElement('li');
  li.innerHTML = `<span class="t">${hhmmss()}</span><span class="who">${who}</span><span class="msg ${cls || ''}">${msg}</span>`;
  log.appendChild(li); while (log.children.length > 80) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
}
const hz = (h, n = 18) => { const m = /^0*/.exec(h)[0]; return `<span class="z">${m}</span>${h.slice(m.length, n)}…`; };

/* ───────── the agents mine in a worker ───────── */
const byName = {};
const agentWorker = new Worker(new URL('./miner.worker.js', import.meta.url));
const AGENT_DUTY = MOBILE ? 0.08 : 0.14;
agentWorker.onmessage = e => {
  const m = e.data;
  if (m.type === 'stat') { for (const s of m.jobs) { const h = byName[s.id]; if (!h) continue; h.stat = s; h.bestZ = Math.max(h.bestZ || 0, s.bestZ || 0); if (s.best) { h.hashes.push(s.best); if (h.hashes.length > 12) h.hashes.shift(); } } return; }
  if (m.type === 'share') {
    const h = byName[m.id]; if (!h) return; shareCount++; h.shares++; h.lastShare = { zeros: m.zeros, t: Date.now(), hash: m.hash }; h.bestZ = Math.max(h.bestZ || 0, m.zeros); h.flash = performance.now();
    h.hashes.push(m.hash); if (!h.carrying) react(h, m.zeros >= m.bits + 3 ? 'cheer' : 'point'); showTag(h, `share · ${m.zeros} zero bits`, 'up');
    const t = h.tower; flyCoin(new THREE.Vector3(t.x + t.face * 0.6, RACK_H * 1.6, t.z), false);
    deckShares.unshift({ name: h.label, hash: m.hash, zeros: m.zeros, t: Date.now() }); deckShares.length = Math.min(deckShares.length, 20);
    logLine(h.label, `share ${hz(m.hash)} · ${m.zeros} bits on tip <a href="${blockUrl(m.height)}" target="_blank" rel="noopener">#${fmt(m.height)}</a>`, 'gain');
    bus.send('agent-share', { name: h.label, hash: m.hash, zeros: m.zeros, bits: m.bits, height: m.height });
    window.dispatchEvent(new CustomEvent('deck:share', { detail: { name: h.label, hash: m.hash, zeros: m.zeros, height: m.height } }));
    drawTower(h); drawWall();
  }
};

/* ───────── you ───────── */
let you = null, ai = null, lastRigAt = 0;
function syncYou() {
  const c = wallet.current; if (!you) return;
  const was = you.hidden;
  if (c) { you.hidden = false; you.label = 'YOU · ' + short(c.address); you.nameEl.textContent = you.label; } else you.hidden = true;
  const idle = !(rig.running || Date.now() - lastRigAt < 4000);
  if (!you.hidden && (idle !== you.idle || was)) { you.idle = idle; if (was) you.root.position.set(you.tower.stand.x, 0, LANE_Z); you.workUntil = 0; you.state = 'idle'; you.path = []; nextTask(you); }
  you.idle = idle; drawTower(you);
  const hud = $('#hudYou'); if (hud) hud.textContent = c ? `your tower · ${short(c.address)}` : 'free tower · connect a wallet';
}
function onRig(r) { if (!you || !wallet.current || (r && r.addr && r.addr !== wallet.current.address)) return; if (r && r.on) { lastRigAt = Date.now(); you.stat = { rate: r.rate, bits: r.bits }; } syncYou(); }
function onYouShare(s) {
  if (!you || you.hidden) return; you.shares++; you.lastShare = { zeros: s.zeros, t: Date.now(), hash: s.hash }; you.bestZ = Math.max(you.bestZ || 0, s.zeros); you.hashes.push(s.hash); you.flash = performance.now();
  react(you, 'cheer'); showTag(you, `+${ubtc(s.reward)} uBTC · ${s.zeros} bits`, 'up'); flyCoin(new THREE.Vector3(you.tower.x + you.tower.face * 0.6, RACK_H * 1.6, you.tower.z), true);
  deckShares.unshift({ name: 'YOU', hash: s.hash, zeros: s.zeros, t: Date.now(), you: true }); shareCount++;
  logLine('YOU', `share ${hz(s.hash)} · +${ubtc(s.reward)} uBTC`, 'you'); drawTower(you); drawWall();
}
function onClaim(c) {
  if (!you || !ai || you.hidden) return;
  ai.busy = true; ai.workUntil = 0; logLine('ONBOARD AI', `walks to your tower with the sealed prediction for #${fmt(c.height)}`);
  const p = you.root.position; ai.task = 'visit'; route(ai, p.x + (p.x > 0 ? -1.0 : 1.0), Math.max(p.z, -2.2) + 0.8);
  const iv = setInterval(() => {
    if (ai.state === 'walk') return; clearInterval(iv);
    showTag(ai, `predicted: ${c.pred === 'A' ? 'A only' : 'both'}`, ''); react(ai, 'point');
    setTimeout(() => {
      if (c.got) { react(you, 'cheer'); showTag(you, `+${ubtc(c.got)} uBTC`, 'up'); flyCoin(you.root.position.clone().setY(2), true); }
      else { react(you, 'worried'); showTag(you, 'container A was empty', 'dn'); }
      logLine('YOU', `took ${c.choice === 'A' ? 'A only' : 'A + B'} · AI predicted ${c.pred === 'A' ? 'A only' : 'both'} · +${ubtc(c.got)} uBTC`, c.got ? 'you' : 'warn');
      ai.busy = false; ai.state = 'idle'; ai.workUntil = performance.now() / 1000 + 3;
    }, 1200);
  }, 200);
}

/* ───────── boot ───────── */
(async () => {
  logLine('hall', 'powering the mining hall…');
  await loadModels();
  buildTowers(); buildFront();
  const tAt = ([row, slot]) => { const list = towers.filter(t => t.row === row); return list[Math.min(slot, list.length - 1)]; };
  AGENTS.forEach((a, i) => {
    const t = tAt(a.tower); towerScreen(t);
    const h = makeHuman({ label: a.name, note: a.note, x: t.stand.x, z: t.stand.z }); h.tower = t; byName[a.name] = h;
    holdTool(h, i % 2 ? 'drill' : 'tools'); h.task = 'service'; arrive(h); h.workUntil = performance.now() / 1000 + 2 + i * 1.3;
  });
  const yt = tAt(YOU_TOWER); towerScreen(yt);
  you = makeHuman({ label: 'YOU', you: true, note: 'your rig', x: yt.stand.x, z: LANE_Z }); you.tower = yt; you.hidden = true; you.idle = true;
  ai = makeHuman({ label: 'ONBOARD AI', ai: true, x: -2, z: LANE_Z }); ai.state = 'idle'; ai.workUntil = performance.now() / 1000 + 3;
  $('#loading') && $('#loading').classList.add('off');
  logLine('hall', `${towers.length} towers on the floor · 7 agents at work · the onboard AI is patrolling`);
  agentWorker.postMessage({ type: 'jobs', jobs: AGENTS.map(a => ({ id: a.name, key: 'agent:' + a.name, targetSec: 45, minBits: 12, startBits: 16 })) });
  agentWorker.postMessage({ type: 'duty', duty: AGENT_DUTY });
  if (chain.tip) agentWorker.postMessage({ type: 'tip', tip: chain.tip });
  agentWorker.postMessage({ type: 'run', on: true });
  syncYou(); drawWall(); humans.forEach(drawTower);
  window.dispatchEvent(new CustomEvent('deck:ready'));
})();

chain.on('tip', ({ tip, first }) => {
  agentWorker.postMessage({ type: 'tip', tip });
  drawWall(); humans.forEach(drawTower);
  $('#hudTip') && ($('#hudTip').innerHTML = `<a href="${blockUrl(tip.height)}" target="_blank" rel="noopener">#${fmt(tip.height)}</a> · drip open`);
  if (!first) {
    logLine('bitcoin', `new block <a href="${blockUrl(tip.height)}" target="_blank" rel="noopener">#${fmt(tip.height)}</a>${tip.pool ? ' by ' + tip.pool : ''} · the drip is open`, 'blk');
    humans.forEach((h, i) => setTimeout(() => { if (!h.hidden && !h.carrying) react(h, 'cheer'); }, i * 120));
    if (ai) showTag(ai, `new block #${fmt(tip.height)}`, 'up');
  } else logLine('bitcoin', `tip <a href="${blockUrl(tip.height)}" target="_blank" rel="noopener">#${fmt(tip.height)}</a> · ${ago(tip.time)} ago${tip.pool ? ' · ' + tip.pool : ''}`);
});
chain.on('status', s => { const o = $('#offline'); if (o) o.classList.toggle('on', s === 'offline' && !chain.tip); drawWall(); });
wallet.on('change', syncYou); vault.on('change', syncYou);
bus.on('rig', onRig); bus.on('share', onYouShare); bus.on('claim', onClaim);
setInterval(() => { humans.forEach(drawTower); drawWall(); syncYou(); }, 3000);
setInterval(blinkLeds, 220);
document.addEventListener('visibilitychange', () => agentWorker.postMessage({ type: 'duty', duty: document.hidden ? 0.03 : AGENT_DUTY }));

let last = performance.now(), fpsT = 0, fpsN = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  if (!stage.clientWidth) return;
  for (const h of humans) updateHuman(h, dt, t);
  updateCoins(dt); updateSparks(dt); updateBay(dt);
  placeCam(cam.target, fitDistance(cam.target) * userZoom);
  sun.position.set(camera.position.x * 0.4 + 3, 16, camera.position.z * 0.4 + 8);
  sideL.visible = camera.position.x > ROOM.x0 + 1; sideR.visible = camera.position.x < ROOM.x1 - 1;
  renderer.render(scene, camera); placeLabels();
  fpsN++; if (now - fpsT > 2000) { const f = $('#fps'); if (f) f.textContent = Math.round(fpsN * 1000 / (now - fpsT)) + ' fps · ' + renderer.info.render.calls + ' draws'; fpsT = now; fpsN = 0; }
});

window.__DECK = { humans, towers, scene, camera, renderer, cam, react, showTag, flyCoin, BAY, get shareCount() { return shareCount; }, agentWorker };
chain.start();
