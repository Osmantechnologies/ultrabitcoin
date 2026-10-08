/* backboard.js — the mining hall's back wall: one long video wall of Bitcoin mining, drawn from the hall's REAL work.
   Every number and hash on it comes from the miner worker (an unbiased sample: ~1 in 4096 hashes of every agent, random gaps), the
   agents' shares, or the live Bitcoin tip. Design space 1024×369 = 25 m × 9 m of wall, rendered at 2× (1.5× on phones).
     top band   header strip (live tip, time since block, difficulty, network hashrate, target) + two hash streams
     left       hashes tried by the hall, ticking (partly behind the hanging faucet screen)
     aisle L    SHA-256 machine: a sampled header replayed through all 64 rounds of both passes, checked against the worker
     aisle R    leading-zero-bits histogram of the sample vs the geometric odds, the share target, Bitcoin's target
     right      the race: each agent's nonce counter and hashrate, and how long the hall would take to find a real block
     the rest   hex rain made of the sampled hashes' own characters (it sits behind the towers) */
const DW = 1024, DH = 369;
const C = { bg: '#16100d', rule: '#3a2b22', ink: '#f6ebe1', ink2: '#bba99b', ink3: '#86746a', coral: '#ff7a4d', mint: '#5fd3a0', amber: '#ffb347', violet: '#b49cff', blue: '#7fb4ff' };
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

/* ───────── SHA-256 with a round trace (same algorithm as the worker, written out so each round can be shown) ───────── */
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
function compress(st, w16, trace) {
  const W = new Array(64);
  for (let i = 0; i < 16; i++) W[i] = w16[i] | 0;
  for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (W[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0; }
  let [a, b, c, d, e, f, g, h] = st;
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    if (trace) trace.push({ r: [a, b, c, d, e, f, g, h], w: W[i], k: K[i] });
  }
  return st.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
}
const words = (bytes, off) => Array.from({ length: 16 }, (_, i) => (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]);
const h8 = v => (v >>> 0).toString(16).padStart(8, '0');
// double SHA-256 of an 80-byte header with the last compression of each pass traced
export function traceHeader(hex) {
  const b = new Uint8Array(hex.match(/../g).map(x => parseInt(x, 16)));
  const mid = compress(IV, words(b, 0));
  const blk2 = new Uint8Array(64); blk2.set(b.subarray(64, 80)); blk2[16] = 0x80; blk2[62] = 0x02; blk2[63] = 0x80;   // 640 bits
  const t1 = [], s1 = compress(mid, words(blk2, 0), t1);
  const w3 = [...s1, 0x80000000, 0, 0, 0, 0, 0, 0, 256];
  const t2 = [], s2 = compress(IV, w3, t2);
  const out = []; s2.forEach(v => out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255));
  return { bytes: b, passes: [t1, t2], hash: out.reverse().map(x => x.toString(16).padStart(2, '0')).join('') };
}

export class Backboard {
  constructor(mobile) {
    this.cv = document.createElement('canvas');
    this.k = mobile ? 1.5 : 2;
    this.cv.width = Math.round(DW * this.k); this.cv.height = Math.round(DH * this.k);
    this.ctx = this.cv.getContext('2d');
    this.rows = []; this.scroll = 0;
    this.hist = new Array(33).fill(0); this.sampled = 0; this.total = 0;
    this.pool = '0000000000000000';
    this.rain = Array.from({ length: 110 }, (_, i) => ({ x: i * 9.4, y: Math.random() * DH, v: 22 + Math.random() * 50 }));
    this.queue = []; this.machine = null;
    this.agents = []; this.tip = null; this.netRate = null; this.bits = 20; this.last = performance.now();
    this.nonceView = {};
  }
  ingest(samples, nameOf) {
    for (const s of samples || []) {
      this.sampled++; this.hist[Math.min(32, s.zeros)]++;
      this.rows.push({ name: nameOf(s.id), nonce: s.nonce, hash: s.hash, zeros: s.zeros });
      this.pool = (this.pool + s.hash).slice(-2048);
      if (this.queue.length < 6) this.queue.push({ ...s, name: nameOf(s.id) });
    }
    if (this.rows.length > 60) this.rows.splice(0, this.rows.length - 60);
  }
  share(name, m) { this.rows.push({ name, nonce: m.nonce, hash: m.hash, zeros: m.zeros, share: true }); this.bits = m.bits; }
  setAgents(list) { this.agents = list; }
  setTip(tip) { this.tip = tip; }
  setNet(rate) { this.netRate = rate; }

  draw(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const x = this.ctx; x.setTransform(this.k, 0, 0, this.k, 0, 0);
    x.fillStyle = C.bg; x.fillRect(0, 0, DW, DH);
    this.total = this.agents.reduce((a, h) => a + ((h && h.stat && h.stat.hashes) || 0), 0);
    this.drawRain(x, dt);
    this.drawHeader(x);
    this.drawStreams(x, dt);
    this.drawTotals(x);
    this.drawMachine(x, now);
    this.drawHist(x);
    this.drawRace(x, dt);
    x.fillStyle = '#0b0807'; for (let i = 1; i < 6; i++) x.fillRect(i * DW / 6 - .5, 0, 1, DH);   // video-wall seams
    x.fillRect(0, DH / 2 - .5, DW, 1);
  }
  panel(x, x0, y0, w, h, title, right) {
    x.fillStyle = 'rgba(29,21,17,.94)'; x.fillRect(x0, y0, w, h);
    x.strokeStyle = C.rule; x.lineWidth = 1; x.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1);
    if (title) {
      x.font = `800 11px ${MONO}`; x.fillStyle = C.coral; x.textAlign = 'left'; x.fillText(title, x0 + 8, y0 + 15);
      if (right) { x.font = `500 9px ${MONO}`; x.fillStyle = C.ink3; x.textAlign = 'right'; x.fillText(right, x0 + w - 8, y0 + 15); x.textAlign = 'left'; }
    }
  }
  zeroHash(x, h, px, py, n) {
    const m = /^0*/.exec(h)[0]; const s = h.slice(0, n || 64);
    x.fillStyle = C.coral; x.fillText(s.slice(0, m.length), px, py);
    const w = x.measureText(s.slice(0, m.length)).width; x.fillStyle = C.ink2; x.fillText(s.slice(m.length) + (n && n < 64 ? '…' : ''), px + w, py);
  }
  drawRain(x, dt) {
    x.font = `700 9px ${MONO}`; const P = this.pool;
    for (const c of this.rain) {
      c.y += c.v * dt; if (c.y > DH + 120) { c.y = -Math.random() * 120; c.v = 22 + Math.random() * 50; }
      for (let i = 0; i < 10; i++) {
        const ch = P[(Math.floor(c.y / 10) * 7 + Math.floor(c.x) + i * 13) % P.length] || '0';
        x.globalAlpha = (1 - i / 10) * 0.55; x.fillStyle = ch === '0' ? C.coral : i === 0 ? C.ink : C.ink3;
        x.fillText(ch, c.x + 1, c.y - i * 10);
      }
    }
    x.globalAlpha = 1;
  }
  drawHeader(x) {
    x.fillStyle = '#0f0b09'; x.fillRect(0, 0, DW, 30);
    const t = this.tip; let px = 10;
    x.font = `800 14px ${MONO}`; x.fillStyle = C.mint; x.fillText('● LIVE BITCOIN', px, 20); px += x.measureText('● LIVE BITCOIN').width + 16;
    const put = (k, v, col) => { x.font = `500 9px ${MONO}`; x.fillStyle = C.ink3; x.fillText(k, px, 19); px += x.measureText(k).width + 5; x.font = `800 13px ${MONO}`; x.fillStyle = col || C.ink; x.fillText(v, px, 20); px += x.measureText(v).width + 15; };
    if (t) {
      const since = Math.max(0, Date.now() / 1000 - t.time);
      put('TIP', '#' + t.height.toLocaleString('en-US'));
      put('SINCE BLOCK', `${Math.floor(since / 60)}:${String(Math.floor(since % 60)).padStart(2, '0')}`, C.amber);
      if (t.difficulty) { put('DIFFICULTY', (t.difficulty / 1e12).toFixed(1) + 'T'); put('NEEDS', Math.round(32 + Math.log2(t.difficulty)) + ' ZERO BITS', C.coral); }
      if (this.netRate) put('NETWORK', (this.netRate / 1e21).toFixed(2) + ' ZH/s');
    }
    x.textAlign = 'right'; x.font = `800 13px ${MONO}`; x.fillStyle = C.coral;
    const hall = this.agents.reduce((a, h) => a + ((h && h.stat && h.stat.rate) || 0), 0);
    x.fillText(`HALL ${(hall / 1e3).toFixed(0)} kH/s`, DW - 10, 20); x.textAlign = 'left';
  }
  drawStreams(x, dt) {
    const y0 = 34, h = 80, rowH = 15.5, cols = [[6, 505], [513, 505]];
    for (const [cx, w] of cols) this.panel(x, cx, y0, w, h);
    this.scroll += (this.rows.length - this.scroll) * Math.min(1, dt * 4);
    x.save(); x.beginPath(); cols.forEach(([cx, w]) => x.rect(cx, y0 + 2, w, h - 4)); x.clip();
    x.font = `600 11px ${MONO}`;
    const frac = this.scroll - Math.floor(this.scroll);
    for (let k = 0; k < 12; k++) {
      const r = this.rows[Math.floor(this.scroll) - 1 - k]; if (!r) break;
      const [cx] = cols[k % 2]; const py = y0 + h - 8 - Math.floor(k / 2) * rowH + frac * rowH;
      if (r.share) { x.fillStyle = 'rgba(95,211,160,.18)'; x.fillRect(cx + 2, py - 11, 501, rowH - 1); }
      x.fillStyle = r.share ? C.mint : C.ink; x.fillText((r.share ? '★' : '') + r.name, cx + 8, py);
      x.fillStyle = C.amber; x.fillText((r.nonce >>> 0).toString(16).padStart(8, '0'), cx + 92, py);
      x.fillStyle = C.ink3; x.fillText('→', cx + 156, py);
      this.zeroHash(x, r.hash, cx + 170, py, 40);
      x.fillStyle = r.zeros >= this.bits ? C.mint : C.ink3; x.textAlign = 'right'; x.fillText(r.zeros + 'b', cx + 498, py); x.textAlign = 'left';
    }
    x.restore();
  }
  drawTotals(x) {
    const X = 6, Y = 122, W = 222, H = 120;
    this.panel(x, X, Y, W, H, 'HASHES TRIED');
    x.font = `800 26px ${MONO}`; x.fillStyle = C.ink; x.fillText(this.total.toLocaleString('en-US'), X + 8, Y + 50);
    x.font = `500 9.5px ${MONO}`; x.fillStyle = C.ink3; x.fillText('double SHA-256, by 7 agents, since you arrived', X + 8, Y + 68);
    const sh = this.agents.reduce((a, h) => a + ((h && h.shares) || 0), 0);
    x.font = `800 18px ${MONO}`; x.fillStyle = C.mint; x.fillText(sh + ' shares', X + 8, Y + 98);
  }
  drawMachine(x, now) {
    const X = 236, Y = 122, Wd = 216, H = 242;
    this.panel(x, X, Y, Wd, H, 'SHA-256 MACHINE', this.machine ? this.machine.name : '');
    if (!this.machine || now - this.machine.t0 > 7400) { const s = this.queue.shift(); if (s) { const tr = traceHeader(s.header); this.machine = { ...s, tr, t0: now, ok: tr.hash === s.hash }; } }
    const m = this.machine; if (!m) return;
    x.font = `600 8.6px ${MONO}`;
    const fieldCol = i => i < 32 ? C.blue : i < 64 ? C.violet : i < 76 ? C.amber : C.coral;
    for (let i = 0; i < 80; i++) { x.fillStyle = fieldCol(i); x.fillText(m.tr.bytes[i].toString(16).padStart(2, '0'), X + 8 + (i % 16) * 12.6, Y + 30 + Math.floor(i / 16) * 10.5); }
    const step = Math.min(128, Math.floor((now - m.t0) / 46)); const pass = step < 64 ? 0 : 1, rnd = step >= 128 ? 63 : step % 64;
    const tr = m.tr.passes[step >= 128 ? 1 : pass][rnd];
    x.font = `800 12px ${MONO}`; x.fillStyle = C.ink; x.fillText(`pass ${step >= 128 ? 2 : pass + 1} · round ${String(rnd + 1).padStart(2, '0')}/64`, X + 8, Y + 98);
    'abcdefgh'.split('').forEach((n, i) => {
      const py = Y + 116 + i * 13.5; const hot = i === 0 || i === 4;
      x.font = `500 9px ${MONO}`; x.fillStyle = C.ink3; x.fillText(n, X + 8, py);
      x.font = `700 11px ${MONO}`; x.fillStyle = hot ? C.coral : C.ink2; x.fillText(h8(tr.r[i]), X + 20, py);
      x.fillStyle = hot ? 'rgba(255,122,77,.6)' : 'rgba(187,169,155,.25)'; x.fillRect(X + 84, py - 7, ((tr.r[i] >>> 0) / 4294967295) * 122, 6);
    });
    for (let i = 0; i < 128; i++) { x.fillStyle = i < step ? (i < 64 ? C.amber : C.coral) : C.rule; x.fillRect(X + 8 + i * 1.56, Y + 225, 1.1, 6); }
    x.font = `600 9.5px ${MONO}`;
    if (step >= 128) { this.zeroHash(x, m.tr.hash, X + 8, Y + 217, 26); x.fillStyle = m.ok ? C.mint : C.coral; x.textAlign = 'right'; x.fillText(m.ok ? '✓ = worker' : '✗', X + Wd - 8, Y + 217); x.textAlign = 'left'; }
    else { x.fillStyle = C.ink3; x.fillText(`nonce ${(m.nonce >>> 0).toString(16).padStart(8, '0')}`, X + 8, Y + 217); }
  }
  drawHist(x) {
    const X = 572, Y = 122, Wd = 216, H = 242;
    this.panel(x, X, Y, Wd, H, 'LEADING ZERO BITS', `${this.sampled.toLocaleString('en-US')} sampled`);
    const bins = 24, bx = X + 10, by = Y + 186, bw = (Wd - 20) / bins, bh = 150;
    const max = Math.max(1, ...this.hist.slice(0, bins)); const sc = v => Math.sqrt(v / max) * bh;
    for (let i = 0; i < bins; i++) { const v = this.hist[i]; x.fillStyle = i >= this.bits ? C.mint : i >= 8 ? C.coral : C.amber; x.globalAlpha = v ? .92 : .15; const hg = Math.max(1.5, sc(v)); x.fillRect(bx + i * bw + .5, by - hg, bw - 1.5, hg); }
    x.globalAlpha = 1;
    if (this.sampled) { x.strokeStyle = C.ink2; x.setLineDash([3, 3]); x.beginPath(); for (let i = 0; i < bins; i++) { const py = by - sc(this.sampled * Math.pow(2, -(i + 1))); const px = bx + i * bw + bw / 2; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.setLineDash([]); }
    const tx = bx + this.bits * bw; x.strokeStyle = C.mint; x.beginPath(); x.moveTo(tx, by - bh); x.lineTo(tx, by + 3); x.stroke();
    x.font = `700 9px ${MONO}`; x.fillStyle = C.mint; x.fillText(`share ≥${this.bits}`, Math.min(tx + 3, X + Wd - 56), by - bh + 8);
    x.fillStyle = C.ink3; for (let i = 0; i < bins; i += 4) x.fillText(String(i), bx + i * bw, by + 12);
    const need = this.tip && this.tip.difficulty ? Math.round(32 + Math.log2(this.tip.difficulty)) : 79;
    x.font = `700 10px ${MONO}`; x.fillStyle = C.coral; x.fillText(`bitcoin needs ${need} bits →`, X + 8, Y + 222);
    x.font = `500 8.5px ${MONO}`; x.fillStyle = C.ink3; x.fillText('dashed: the odds, 2^-(k+1)', X + 8, Y + 234);
  }
  drawRace(x, dt) {
    const X = 850, Y = 122, Wd = 168, H = 242;
    this.panel(x, X, Y, Wd, H, 'THE RACE', 'nonce');
    const ag = this.agents.filter(Boolean);
    const maxR = Math.max(1, ...ag.map(h => (h.stat && h.stat.rate) || 0));
    ag.forEach((h, i) => {
      const py = Y + 36 + i * 26; const st = h.stat || {};
      const prev = this.nonceView[h.label]; const nv = this.nonceView[h.label] = prev == null || Math.abs((st.nonce || 0) - prev) > 5e6 ? (st.nonce || 0) : prev + (st.rate || 0) / 7 * dt;
      x.font = `800 10.5px ${MONO}`; x.fillStyle = h.flash && performance.now() - h.flash < 1500 ? C.mint : C.ink; x.fillText(h.label, X + 8, py);
      x.font = `600 9.5px ${MONO}`; x.fillStyle = C.amber; x.textAlign = 'right'; x.fillText((Math.floor(nv) >>> 0).toString(16).padStart(8, '0'), X + Wd - 8, py); x.textAlign = 'left';
      x.fillStyle = C.rule; x.fillRect(X + 8, py + 4, Wd - 16, 4);
      x.fillStyle = C.coral; x.fillRect(X + 8, py + 4, (Wd - 16) * ((st.rate || 0) / maxR), 4);
    });
    const hall = ag.reduce((a, h) => a + ((h.stat && h.stat.rate) || 0), 0);
    if (this.tip && this.tip.difficulty && hall) {
      const yrs = this.tip.difficulty * 4294967296 / hall / 31557600; const e = Math.floor(Math.log10(yrs));
      x.font = `500 8.5px ${MONO}`; x.fillStyle = C.ink2; x.fillText('a real block at this rate:', X + 8, Y + 222);
      x.font = `800 10.5px ${MONO}`; x.fillStyle = C.coral; x.fillText(`every ${(yrs / Math.pow(10, e)).toFixed(1)}×10^${e} years`, X + 8, Y + 235);
    }
  }
}
