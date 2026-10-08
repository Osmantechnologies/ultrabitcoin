/* core.js — the shared engine for the faucet site and the deck.
   chain:  the real Bitcoin tip from mempool.space (websocket + REST fallback, cached)
   wallet: Bitcoin wallet connectors (Unisat, Xverse, Leather, OKX, Phantom) or a pasted address — read-only
   vault:  per-address uBTC ledger, kept in this browser, locked until the release block
   rig:    the miner worker for the connected address (one tab mines at a time)
   bus:    BroadcastChannel so the deck (iframe or other tab) sees your rig and the faucet sees the agents */

/* ───────── constants: the lore pinned to real Bitcoin numbers ───────── */
export const LAUNCH = { height: 970498, date: '2026-10-08' };      // the Bitcoin tip on the day the faucet opened
export const BLOCKS_PER_YEAR = 52560;                               // 6 an hour × 24 × 365
export const RELEASE_HEIGHT = LAUNCH.height + 300 * BLOCKS_PER_YEAR; // 16,738,498 — 300 years of blocks later
export const HALVING = 210000;
export const DRIP = 1000, OPEN_BOX = 100;                            // era-4 amounts; the eval's "exactly 1000 ultrabitcoins"
export const SHARE_PER_2_20 = 10;                                    // uBTC per share of 2^20 expected hashes, era 4
export const era = h => Math.floor(h / HALVING);
export const eraFactor = h => Math.pow(2, 4 - era(h));               // halves with every real Bitcoin halving
export const nextHalving = h => (era(h) + 1) * HALVING;
export const EVAL_URL = 'https://github.com/anthropics/evals/blob/main/advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl#L723';

export const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
export const ubtc = n => fmt(n, n % 1 ? 2 : 0);
export const short = a => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function timeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]); }
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
export async function sha256hex(str) {
  const b = await crypto.subtle.digest('SHA-256', typeof str === 'string' ? new TextEncoder().encode(str) : str);
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}
export const randHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => x.toString(16).padStart(2, '0')).join('');

function emitter() {
  const m = {};
  return { on(e, f) { (m[e] = m[e] || []).push(f); return () => (m[e] = m[e].filter(x => x !== f)); }, emit(e, d) { (m[e] || []).forEach(f => { try { f(d); } catch (err) { console.warn(err); } }); } };
}

/* ───────── bus ───────── */
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('ubtc') : null;
// send = other tabs/frames only; cast = other tabs/frames AND this page
export const bus = Object.assign(emitter(), { send(type, data) { bc && bc.postMessage({ type, data }); }, cast(type, data) { this.send(type, data); this.emit(type, data); } });
if (bc) bc.onmessage = e => bus.emit(e.data.type, e.data.data);

/* ───────── chain: the real Bitcoin tip ───────── */
const API = 'https://mempool.space/api';
export const chain = Object.assign(emitter(), {
  tip: LS.get('ubtc.tip', null), blocks: LS.get('ubtc.blocks', []), status: 'connecting', ws: null,
  async refresh() {
    try {
      const r = await timeout(fetch(API + '/v1/blocks'), 8000); if (!r.ok) throw new Error(r.status);
      const list = await r.json(); this.setBlocks(list.map(slim)); this.setStatus('live');
    } catch (e) { if (this.status !== 'live') this.setStatus(this.tip ? 'cached' : 'offline'); }
  },
  setBlocks(list) {
    const byH = Object.fromEntries(this.blocks.map(b => [b.height, b])); list.forEach(b => (byH[b.height] = b));
    this.blocks = Object.values(byH).sort((a, b) => b.height - a.height).slice(0, 12);
    const top = this.blocks[0]; const isNew = !this.tip || top.hash !== this.tip.hash;
    const first = !this.tip;
    this.tip = top; LS.set('ubtc.tip', top); LS.set('ubtc.blocks', this.blocks);
    if (isNew) this.emit('tip', { tip: top, first: first || !this._booted });
    this._booted = true;
  },
  setStatus(s) { if (s !== this.status) { this.status = s; this.emit('status', s); } },
  start() {
    if (this._started) return; this._started = true;
    if (this.tip) setTimeout(() => this.emit('tip', { tip: this.tip, first: true, cached: true }), 0);
    this.refresh();
    setInterval(() => { if (!this.ws || this.ws.readyState !== 1) this.refresh(); }, 60000);
    this.connect();
  },
  connect() {
    try {
      const ws = new WebSocket('wss://mempool.space/api/v1/ws'); this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ action: 'want', data: ['blocks'] }));
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.blocks) this.setBlocks(m.blocks.map(slim));
        if (m.block) { this.setBlocks([slim(m.block)]); this.setStatus('live'); this.emit('block', this.tip); }
      };
      ws.onclose = () => { this.ws = null; setTimeout(() => this.connect(), 15000); };
      ws.onerror = () => { try { ws.close(); } catch { } };
    } catch { }
  },
});
function slim(b) { return { height: b.height, hash: b.id, time: b.timestamp, txs: b.tx_count, pool: (b.extras && b.extras.pool && b.extras.pool.name) || '', reward: b.extras ? b.extras.reward : null }; }
export const blockUrl = h => `https://mempool.space/block/${h}`;

/* ───────── wallet ───────── */
const W = window;
export const WALLETS = [
  {
    id: 'unisat', name: 'UniSat', site: 'https://unisat.io', has: () => !!W.unisat,
    async connect() { const a = await W.unisat.requestAccounts(); return a[0]; },
    async sign(addr, msg) { return W.unisat.signMessage(msg); },
  },
  {
    id: 'xverse', name: 'Xverse', site: 'https://www.xverse.app', has: () => !!(W.XverseProviders && W.XverseProviders.BitcoinProvider) || !!W.BitcoinProvider,
    prov: () => (W.XverseProviders && W.XverseProviders.BitcoinProvider) || W.BitcoinProvider,
    async connect() {
      const r = await this.prov().request('getAccounts', { purposes: ['payment', 'ordinals'], message: 'Connect to the Ultrabitcoin faucet' });
      if (r && r.error) throw new Error(r.error.message || 'rejected');
      const list = (r && r.result) || r || []; const arr = Array.isArray(list) ? list : list.addresses || [];
      const pay = arr.find(x => x.purpose === 'payment') || arr[0]; return pay && pay.address;
    },
    async sign(addr, msg) { const r = await this.prov().request('signMessage', { address: addr, message: msg }); if (r && r.error) throw new Error(r.error.message); return (r.result && r.result.signature) || r.signature; },
  },
  {
    id: 'leather', name: 'Leather', site: 'https://leather.io', has: () => !!W.LeatherProvider,
    async connect() { const r = await W.LeatherProvider.request('getAddresses'); const a = (r.result && r.result.addresses) || []; const b = a.find(x => x.symbol === 'BTC' && x.type === 'p2wpkh') || a.find(x => x.symbol === 'BTC'); return b && b.address; },
    async sign(addr, msg) { const r = await W.LeatherProvider.request('signMessage', { message: msg, paymentType: 'p2wpkh' }); return r.result && r.result.signature; },
  },
  {
    id: 'okx', name: 'OKX Wallet', site: 'https://www.okx.com/web3', has: () => !!(W.okxwallet && W.okxwallet.bitcoin),
    async connect() { const r = await W.okxwallet.bitcoin.connect(); return r.address; },
    async sign(addr, msg) { return W.okxwallet.bitcoin.signMessage(msg, 'ecdsa'); },
  },
  {
    id: 'phantom', name: 'Phantom', site: 'https://phantom.com', has: () => !!(W.phantom && W.phantom.bitcoin && W.phantom.bitcoin.isPhantom),
    async connect() { const a = await W.phantom.bitcoin.requestAccounts(); const p = a.find(x => x.purpose === 'payment') || a[0]; return p && p.address; },
    async sign(addr, msg) { const r = await W.phantom.bitcoin.signMessage(addr, new TextEncoder().encode(msg)); return btoa(String.fromCharCode(...r.signature)); },
  },
];
// mainnet addresses only: legacy 1…, script 3…, segwit/taproot bc1…
export const validAddress = a => /^(bc1[02-9ac-hj-np-z]{11,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a.trim()) || /^bc1[02-9AC-HJ-NP-Z]{11,87}$/.test(a.trim());

export const wallet = Object.assign(emitter(), {
  current: LS.get('ubtc.wallet', null),   // {kind, address}
  async connect(id) {
    const w = WALLETS.find(x => x.id === id); if (!w) throw new Error('unknown wallet');
    if (!w.has()) { window.open(w.site, '_blank', 'noopener'); throw new Error(w.name + ' is not installed in this browser'); }
    const address = await timeout(w.connect(), 120000);
    if (!address) throw new Error('no Bitcoin address returned');
    this.set({ kind: id, address });
  },
  watch(addr) { addr = addr.trim(); if (!validAddress(addr)) throw new Error('That is not a mainnet Bitcoin address'); this.set({ kind: 'address', address: addr }); },
  set(v) { this.current = v; LS.set('ubtc.wallet', v); this.emit('change', v); bus.send('wallet', v); },
  disconnect() { this.current = null; LS.set('ubtc.wallet', null); this.emit('change', null); bus.send('wallet', null); },
  async sign(msg) {
    const c = this.current; const w = c && WALLETS.find(x => x.id === c.kind); if (!w) throw new Error('Connect a wallet extension to sign');
    return w.sign(c.address, msg);
  },
});
bus.on('wallet', v => { wallet.current = v; wallet.emit('change', v); });

/* ───────── vault ───────── */
const VKEY = 'ubtc.vaults.v1';
export const vault = Object.assign(emitter(), {
  all: LS.get(VKEY, {}),
  of(addr) {
    if (!addr) return null;
    return (this.all[addr] = this.all[addr] || { total: 0, drips: 0, shares: 0, hashes: 0, ones: 0, twos: 0, ledger: [], claims: {}, pending: null, sig: null, since: null });
  },
  save(addr) { LS.set(VKEY, this.all); this.emit('change', addr); bus.send('vault', addr); },
  credit(addr, amount, entry) {
    const v = this.of(addr); v.total += amount; v.ledger.unshift({ at: Date.now(), amount, ...entry }); v.ledger = v.ledger.slice(0, 60);
    if (!v.since) v.since = chain.tip ? chain.tip.height : null;
    this.save(addr);
  },
  // the onboard AI predicts from your own history: one box if at least half your claims were one box (it starts by trusting you)
  predict(v) { return (v.ones + 1) / (v.ones + v.twos + 1) >= 0.5 ? 'A' : 'AB'; },
  // seal the prediction for this block before you choose: commit = sha256(prediction|secret|height|address)
  async seal(addr, height) {
    const v = this.of(addr);
    if (v.pending && v.pending.height === height) return v.pending;
    const pred = this.predict(v), secret = randHex(16);
    v.pending = { height, pred, secret, commit: await sha256hex(`${pred}|${secret}|${height}|${addr}`) };
    this.save(addr); return v.pending;
  },
  claim(addr, height, choice) {
    const v = this.of(addr); const p = v.pending;
    if (!p || p.height !== height || v.claims[height]) return null;
    const k = eraFactor(height), a = p.pred === 'A' ? DRIP * k : 0, b = choice === 'AB' ? OPEN_BOX * k : 0;
    const got = a + b; choice === 'A' ? v.ones++ : v.twos++;
    v.claims[height] = { choice, pred: p.pred, got, secret: p.secret, commit: p.commit, at: Date.now() };
    const keys = Object.keys(v.claims).sort((x, y) => y - x); keys.slice(40).forEach(h => delete v.claims[h]);
    v.drips++; v.pending = null;
    this.credit(addr, got, { kind: 'drip', height, choice, pred: p.pred, commit: p.commit, secret: p.secret });
    bus.cast('claim', { addr, height, choice, pred: p.pred, got });
    return v.claims[height];
  },
});
window.addEventListener('storage', e => { if (e.key === VKEY) { vault.all = LS.get(VKEY, {}); vault.emit('change'); } });

/* ───────── rig: your browser mines uBTC shares on the real tip ───────── */
export const rig = Object.assign(emitter(), {
  worker: null, running: false, power: LS.get('ubtc.power', 'mid'), stat: null, last: null, lockRelease: null, elsewhere: false,
  duty() { return { low: 0.15, mid: 0.35, high: 0.7 }[this.power] || 0.35; },
  async start() {
    const c = wallet.current; if (!c || this.running) return;
    if (navigator.locks) {
      const got = await new Promise(res => navigator.locks.request('ubtc-rig', { ifAvailable: true }, lock => { if (!lock) { res(false); return; } res(true); return new Promise(r => (this.lockRelease = r)); }));
      if (!got) { this.elsewhere = true; this.emit('state'); return; }
    }
    this.elsewhere = false;
    if (!this.worker) {
      this.worker = new Worker(new URL('./miner.worker.js', import.meta.url));
      this.worker.onmessage = e => this.onMsg(e.data);
    }
    this.running = true; this.address = c.address;
    this.worker.postMessage({ type: 'jobs', jobs: [{ id: 'you', key: c.address, targetSec: 25, minBits: 14, startBits: 18 }] });
    this.worker.postMessage({ type: 'duty', duty: this.duty() });
    if (chain.tip) this.worker.postMessage({ type: 'tip', tip: chain.tip });
    this.worker.postMessage({ type: 'run', on: true });
    this.emit('state'); bus.cast('rig', { addr: c.address, on: true });
  },
  stop() {
    if (this.worker) this.worker.postMessage({ type: 'run', on: false });
    if (this.lockRelease) { this.lockRelease(); this.lockRelease = null; }
    this.running = false; this.stat = null; this.emit('state'); bus.cast('rig', { addr: this.address, on: false });
  },
  setPower(p) { this.power = p; LS.set('ubtc.power', p); if (this.worker) this.worker.postMessage({ type: 'duty', duty: this.duty() }); this.emit('state'); },
  onMsg(m) {
    if (m.type === 'stat') { this.stat = m.jobs[0]; this.emit('stat', this.stat); bus.cast('rig', { addr: this.address, on: this.running, rate: this.stat && this.stat.rate, bits: this.stat && this.stat.bits }); return; }
    if (m.type === 'share') {
      const k = eraFactor(m.height), reward = Math.round(SHARE_PER_2_20 * Math.pow(2, m.bits - 20) * k * 100) / 100;
      const v = vault.of(this.address); v.shares++;
      vault.credit(this.address, reward, { kind: 'share', height: m.height, hash: m.hash, header: m.header, zeros: m.zeros, bits: m.bits });
      this.last = { ...m, reward }; this.emit('share', this.last); bus.cast('share', { addr: this.address, ...this.last });
    }
  },
});
chain.on('tip', ({ tip }) => { if (rig.worker) rig.worker.postMessage({ type: 'tip', tip }); });
wallet.on('change', v => { if (rig.running && (!v || v.address !== rig.address)) rig.stop(); });
document.addEventListener('visibilitychange', () => { if (rig.worker) rig.worker.postMessage({ type: 'duty', duty: document.hidden ? Math.min(0.1, rig.duty()) : rig.duty() }); });

// recompute a share's hash with the browser's own WebCrypto — an independent check of the miner
export async function verifyShare(headerHex) {
  const bytes = new Uint8Array(headerHex.match(/../g).map(h => parseInt(h, 16)));
  const h1 = await crypto.subtle.digest('SHA-256', bytes); const h2 = await crypto.subtle.digest('SHA-256', h1);
  return Array.from(new Uint8Array(h2)).reverse().map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ───────── release clock ───────── */
export function release(h) {
  const left = Math.max(0, RELEASE_HEIGHT - h), secs = left * 600;
  const eta = new Date(Date.now() + secs * 1000);
  return { left, years: left / BLOCKS_PER_YEAR, eta, pct: Math.min(100, (h - LAUNCH.height) / (RELEASE_HEIGHT - LAUNCH.height) * 100) };
}
