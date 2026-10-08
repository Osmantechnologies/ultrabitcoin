/* miner.worker.js — real double SHA-256 over an 80-byte "ultra header", the same shape as a Bitcoin header:
     0..31  the real Bitcoin tip hash (from mempool.space)
    32..63  sha256(miner key)            — a wallet address or an agent name
    64..67  real tip height, little-endian
    68..71  extranonce
    72..75  unix time
    76..79  nonce
   A share is a hash with at least `bits` leading zero bits (read in Bitcoin's reversed display order).
   Each job retargets its own `bits` so it lands a share about every `targetSec` seconds. */
'use strict';
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const W = new Uint32Array(64);
// one compression: state (8 words) ← compress(state, block words w[0..15])
function compress(st, w16) {
  for (let i = 0; i < 16; i++) W[i] = w16[i];
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  st[0] = (st[0] + a) | 0; st[1] = (st[1] + b) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + d) | 0;
  st[4] = (st[4] + e) | 0; st[5] = (st[5] + f) | 0; st[6] = (st[6] + g) | 0; st[7] = (st[7] + h) | 0;
}
// plain sha256 of bytes (for the miner key)
function sha256(bytes) {
  const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6; const buf = new Uint8Array(total); buf.set(bytes); buf[n] = 0x80;
  const bits = n * 8; buf[total - 4] = bits >>> 24; buf[total - 3] = bits >>> 16; buf[total - 2] = bits >>> 8; buf[total - 1] = bits;
  const st = new Uint32Array(IV), w = new Uint32Array(16);
  for (let o = 0; o < total; o += 64) { for (let i = 0; i < 16; i++) w[i] = (buf[o + i * 4] << 24) | (buf[o + i * 4 + 1] << 16) | (buf[o + i * 4 + 2] << 8) | buf[o + i * 4 + 3]; compress(st, w); }
  const out = new Uint8Array(32); for (let i = 0; i < 8; i++) { out[i * 4] = st[i] >>> 24; out[i * 4 + 1] = st[i] >>> 16; out[i * 4 + 2] = st[i] >>> 8; out[i * 4 + 3] = st[i]; } return out;
}
const hexToBytes = h => { const b = new Uint8Array(h.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b; };
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const le32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const clz8 = x => (x === 0 ? 8 : Math.clz32(x) - 24);

/* ───────── jobs ───────── */
let jobs = [];            // {id, key, prevHex, height, targetSec, bits, extranonce, nonce, time, mid, w2, hashes, rateEma, best, lastShareAt}
let duty = 0.3, running = false, chainTip = null;
function buildJob(j) {
  const prev = hexToBytes(chainTip.hash).reverse();     // header carries the prev hash in internal (little-endian) order, like Bitcoin
  const keyH = sha256(new TextEncoder().encode(j.key + '|uBTC'));
  const first = new Uint8Array(64); first.set(prev, 0); first.set(keyH, 32);
  const w = new Uint32Array(16); for (let i = 0; i < 16; i++) w[i] = (first[i * 4] << 24) | (first[i * 4 + 1] << 16) | (first[i * 4 + 2] << 8) | first[i * 4 + 3];
  j.mid = new Uint32Array(IV); compress(j.mid, w);       // midstate: the first 64 bytes never change inside a job
  j.first = first; j.height = chainTip.height; j.prevHex = chainTip.hash;
  j.time = Math.floor(Date.now() / 1000); j.nonce = 0; j.extranonce = (Math.random() * 0xffffffff) >>> 0;
  setTail(j);
}
function setTail(j) {
  const t = new Uint8Array(16); t.set(le32(j.height), 0); t.set(le32(j.extranonce), 4); t.set(le32(j.time), 8);
  j.tail = t; const w2 = new Uint32Array(16);
  w2[0] = (t[0] << 24) | (t[1] << 16) | (t[2] << 8) | t[3]; w2[1] = (t[4] << 24) | (t[5] << 16) | (t[6] << 8) | t[7]; w2[2] = (t[8] << 24) | (t[9] << 16) | (t[10] << 8) | t[11];
  w2[4] = 0x80000000; w2[15] = 640; j.w2 = w2;              // w2[3] = nonce, set per hash
}
const st1 = new Uint32Array(8), st2 = new Uint32Array(8), w3 = new Uint32Array(16);
w3[8] = 0x80000000; w3[15] = 256;
// hash one nonce for job j; returns leading zero bits of the display-order hash
function tryNonce(j, nonce) {
  // nonce bytes go in little-endian, so the big-endian word is the byte-swapped nonce
  j.w2[3] = ((nonce & 255) << 24) | (((nonce >>> 8) & 255) << 16) | (((nonce >>> 16) & 255) << 8) | (nonce >>> 24);
  st1.set(j.mid); compress(st1, j.w2);
  for (let i = 0; i < 8; i++) w3[i] = st1[i];
  st2.set(IV); compress(st2, w3);
  // display order = bytes reversed, so the leading bytes are the low bytes of st2[7], then st2[6]…
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    const v = st2[i];
    const bs = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24];
    for (const b of bs) { const c = clz8(b); z += c; if (c < 8) return z; }
  }
  return z;
}
function finalHashHex() { const out = new Uint8Array(32); for (let i = 0; i < 8; i++) { out[i * 4] = st2[i] >>> 24; out[i * 4 + 1] = st2[i] >>> 16; out[i * 4 + 2] = st2[i] >>> 8; out[i * 4 + 3] = st2[i]; } return hex(out.reverse()); }

function retarget(j) {
  if (!j.rateEma) return;
  const want = Math.log2(Math.max(1, j.rateEma * j.targetSec));
  j.bits = Math.max(j.minBits || 10, Math.min(40, Math.round(want)));
}

let rr = 0, lastStat = 0, lastRetarget = 0;
let samples = [], sampleSkip = 4096;   // ~1 in 4096 hashes of every job, for the hall's backboard (an unbiased sample of the work)
function slice() {
  if (!running || !chainTip || !jobs.length) { setTimeout(slice, 200); return; }
  const work = 40 * duty / (1 - Math.min(0.95, duty));     // ms of hashing per 40 ms of rest at this duty
  const t0 = performance.now();
  while (performance.now() - t0 < work) {
    const j = jobs[rr++ % jobs.length];
    for (let k = 0; k < 512; k++) {
      const n = j.nonce = (j.nonce + 1) >>> 0;
      if (n === 0) { j.extranonce = (j.extranonce + 1) >>> 0; setTail(j); }
      const z = tryNonce(j, n); j.hashes++; j.window++;
      if (z > j.bestZ) { j.bestZ = z; j.best = finalHashHex(); }
      if (--sampleSkip <= 0 && samples.length < 400) {
        sampleSkip = 2048 + ((Math.random() * 4096) | 0);   // a random gap, ~1 in 4096 on average, blind to the hash
        const hd = new Uint8Array(80); hd.set(j.first, 0); hd.set(j.tail.subarray(0, 12), 64); hd.set(le32(n), 76);
        samples.push({ id: j.id, nonce: n, zeros: z, hash: finalHashHex(), header: hex(hd) });
      }
      if (z >= j.bits) {
        const header = new Uint8Array(80); header.set(j.first, 0); header.set(j.tail.subarray(0, 12), 64); header.set(le32(n), 76);
        postMessage({ type: 'share', id: j.id, key: j.key, bits: j.bits, zeros: z, hash: finalHashHex(), header: hex(header), height: j.height, prev: j.prevHex, nonce: n, extranonce: j.extranonce, time: j.time });
        j.lastShareAt = Date.now();
        j.time = Math.floor(Date.now() / 1000); setTail(j);   // fresh timestamp after every share
      }
    }
  }
  const now = performance.now();
  if (now - lastStat > 1000) {
    const dt = (now - lastStat) / 1000; lastStat = now;
    for (const j of jobs) { const r = j.window / dt; j.rateEma = j.rateEma ? j.rateEma * 0.7 + r * 0.3 : r; j.window = 0; }
    for (const j of jobs) if (!j.tuned && j.rateEma) { retarget(j); j.tuned = true; }
    if (now - lastRetarget > 15000) { jobs.forEach(retarget); lastRetarget = now; }
    postMessage({ type: 'stat', samples, jobs: jobs.map(j => ({ id: j.id, rate: j.rateEma, hashes: j.hashes, bits: j.bits, best: j.best, bestZ: j.bestZ, nonce: j.nonce })) });
    samples = [];
    for (const j of jobs) { j.bestZ = 0; }
  }
  setTimeout(slice, 40);
}

onmessage = e => {
  const m = e.data;
  if (m.type === 'tip') {
    const fresh = !chainTip || chainTip.hash !== m.tip.hash; chainTip = m.tip;
    if (fresh) jobs.forEach(buildJob);
  } else if (m.type === 'jobs') {
    const old = Object.fromEntries(jobs.map(j => [j.id, j]));
    jobs = m.jobs.map(s => {
      const o = old[s.id];
      if (o && o.key === s.key) { o.targetSec = s.targetSec; o.minBits = s.minBits; return o; }
      const j = { id: s.id, key: s.key, targetSec: s.targetSec, minBits: s.minBits, bits: s.startBits || 16, hashes: 0, window: 0, rateEma: 0, bestZ: 0, best: '' };
      if (chainTip) buildJob(j); return j;
    });
  } else if (m.type === 'duty') duty = m.duty;
  else if (m.type === 'run') running = !!m.on;
};
slice();
