/* app.js — the uBTC terminal: tab views, chain bar, vault block, kpis, ticker, agents board, bitcoin blocks, status bar.
   The deck itself is sandbox.js; the faucet panes are faucet-ui.js. */
import { chain, wallet, vault, rig, bus, RELEASE_HEIGHT, HALVING, DRIP, OPEN_BOX, SHARE_PER_2_20, EVAL_URL, era, eraFactor, nextHalving, release, fmt, ubtc, short, blockUrl, timeout } from './core.js';
import { mountFaucet } from './faucet-ui.js';
import { mountChip } from './connect.js';
import './sandbox.js';
import { initSources } from './github.js';

const $ = s => document.querySelector(s);
const ago = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : (s / 3600).toFixed(1) + 'h'; };
const rate = r => !r ? '—' : r >= 1e6 ? (r / 1e6).toFixed(2) + ' MH/s' : (r / 1e3).toFixed(0) + ' kH/s';
const hz = (h, n = 20) => { const m = /^0*/.exec(h)[0]; return `<span class="z">${m}</span>${h.slice(m.length, n)}…`; };

['#evalLink', '#evalLink2', '#evalLink3', '#evalChip'].forEach(s => { const a = $(s); if (a) a.href = EVAL_URL; });
$('#cRel').href = blockUrl(RELEASE_HEIGHT);
fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).then(v => ($('#ver').textContent = 'v' + v.trim())).catch(() => { });

/* ───────── views: 0:mine 1:lore 2:halving 3:proof (hash routes, keys 0–3) ───────── */
const VIEWS = ['mine', 'lore', 'halving', 'proof', 'source'];
function route() {
  const h = location.hash.slice(1); const v = VIEWS.includes(h) ? h : 'mine';
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('is-on', x === v));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.v === v));
  $('#statusQ').textContent = { mine: '"mine --deck kaan --tip live"', lore: '"man ultrabitcoin"', halving: '"schedule --until release"', proof: '"proof --open"', source: '"curl … | sed -n 723p"' }[v];
  if (v === 'mine' && h !== 'mine' && VIEWS.includes(h) === false && h) { const el = document.getElementById(h); if (el) el.scrollIntoView(); }
  else if (VIEWS.includes(h)) scrollTo(0, 0);
  window.dispatchEvent(new Event('resize'));
}
addEventListener('hashchange', route); route();
addEventListener('keydown', e => { if (e.target.closest('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return; const i = +e.key; if (e.key >= '0' && e.key <= '4') location.hash = VIEWS[i]; });

/* ───────── faucet panes ───────── */
mountFaucet({ wallet: $('#fxWallet'), drip: $('#fxDrip'), rig: $('#fxRig'), ledger: $('#fxLedger') });
mountChip($('#connectChip'));

/* ───────── chain bar, vault block, status bar ───────── */
function chainBar() {
  const t = chain.tip; if (!t) return;
  const a = $('#cTip'); a.href = blockUrl(t.height); a.innerHTML = `<b>#${fmt(t.height)}</b>`;
  $('#cAgo').textContent = ago(t.time) + ' ago'; $('#cPool').textContent = t.pool || '—';
  $('#cHalv').textContent = `#${fmt(nextHalving(t.height))} · ${fmt(nextHalving(t.height) - t.height)} blocks`;
  $('#cDrip').textContent = fmt(DRIP * eraFactor(t.height));
  $('#sTip').innerHTML = `tip <b>#${fmt(t.height)}</b>`;
  const r = release(t.height);
  $('#kLeft').textContent = fmt(r.left); $('#vaultLeft').textContent = `${fmt(r.left)} blocks to go`; $('#kLeftSub').textContent = `#${fmt(RELEASE_HEIGHT)} · ${r.years.toFixed(3)} yrs`;
  $('#kEra').innerHTML = `${era(t.height)}<small>· ${fmt(DRIP * eraFactor(t.height))} uBTC</small>`; $('#kEraSub').textContent = `halves at #${fmt(nextHalving(t.height))}`;
  $('#vRel').textContent = `opens ${r.eta.toLocaleString('en-US', { month: 'short' }).toLowerCase()} ${r.eta.getFullYear()} · block #${fmt(RELEASE_HEIGHT)}`;
}
function vaultBlock() {
  const c = wallet.current; const v = c ? vault.of(c.address) : null;
  $('#vTotal').textContent = v ? ubtc(v.total) : '0'; $('#sVault').textContent = v ? ubtc(v.total) : '0';
  $('#vSub').textContent = c ? `${short(c.address)} · ${fmt(v.drips)} drips · ${fmt(v.shares)} shares` : 'connect a wallet to start';
  $('#vBtn').textContent = c ? (chain.tip && v.claims[chain.tip.height] ? 'drip claimed · see the faucet' : 'claim this block\'s drip') : 'open the faucet';

}
function liveDot(s) {
  const el = $('#liveDot'); const live = s === 'live';
  el.textContent = live ? '● live bitcoin' : s === 'cached' ? '○ cached tip' : s === 'offline' ? '○ mempool unreachable' : '○ connecting'; el.classList.toggle('off', !live);
  $('#chainStatus').textContent = live ? '● mempool.space' : '○ ' + s;
}
chain.on('tip', () => { chainBar(); vaultBlock(); blocks(); schedule(); });
chain.on('status', liveDot);
wallet.on('change', vaultBlock); vault.on('change', vaultBlock);

/* ───────── bitcoin blocks pane ───────── */
let topH = 0;
function blocks() {
  const list = chain.blocks.slice(0, 9); if (!list.length) return;
  $('#blocks').innerHTML = list.map(b => `<div class="blk ${b.height > topH && topH ? 'new' : ''}"><a href="${blockUrl(b.height)}" target="_blank" rel="noopener">#${fmt(b.height)}</a><span class="p">${b.pool || '—'} · ${fmt(b.txs || 0)} tx</span><span class="a">${ago(b.time)}</span></div>`).join('');
  topH = list[0].height;
}

/* ───────── wallets board (agents × fresh wallets) + kpis, read from the hall ───────── */
function deck() { return window.__DECK; }
const btc = v => v == null ? '—' : (v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(4) : v.toFixed(6));
let fresh = null; const bal = {};
fetch('data/fresh-wallets.json', { cache: 'no-store' }).then(r => r.json()).then(f => {
  fresh = f;
  $('#wnote').innerHTML = `picked ${f.fetched_at.slice(0, 16).replace('T', ' ')} UTC at bitcoin block #${fmt(f.tip)} from mempool.space: first transaction confirmed under 24 hours earlier, at least 0.02 BTC received, still holding. strangers' wallets: the agents put each address into every header they hash, exactly like your rig, and nothing is ever sent to them. "holding" is read live.`;
  refreshBalances(); setInterval(refreshBalances, 120000);
}).catch(() => { });
async function refreshBalances() {
  for (const w of fresh.wallets) {
    try {
      const r = await timeout(fetch(`https://mempool.space/api/address/${w.address}`), 8000); if (!r.ok) continue;
      const d = await r.json(); const c = d.chain_stats, m = d.mempool_stats;
      bal[w.address] = (c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum) / 1e8;
    } catch { }
    await new Promise(r => setTimeout(r, 250));
  }
}
function agents() {
  const D = deck(); if (!D) return;
  const hs = D.humans.filter(h => !h.ai && !h.hidden);
  const rows = hs.slice().sort((a, b) => (b.you ? 1 : 0) - (a.you ? 1 : 0) || (b.mined || 0) - (a.mined || 0));
  const fw = a => fresh && fresh.wallets.find(w => w.address === a);
  $('#agents').innerHTML = `<div class="ag ag--hd"><span>agent</span><span>mining for</span><span class="num">funded</span><span class="num">holding</span><span class="num">uBTC</span><span class="num">shares</span><span>last share</span></div>` +
    rows.map(h => {
      const a = h.you ? (wallet.current && wallet.current.address) : h.wallet; const w = fw(a);
      const mined = h.you ? (a ? vault.of(a).total : 0) : (h.mined || 0);
      const link = a ? `<a href="https://mempool.space/address/${a}" target="_blank" rel="noopener">${a}</a>` : '—';
      return `<div class="ag ${h.you ? 'you' : ''}"><span class="who">${h.you ? 'YOU' : h.label}<i>${h.you ? (rig.running ? 'rig on' : 'idle') : rate(h.stat && h.stat.rate)}</i></span><span class="addr">${link}</span><span class="num">${w ? `<a class="tx" href="https://mempool.space/tx/${w.first_txid}" target="_blank" rel="noopener" title="first funding transaction">${w.first_funded.slice(11, 16)} UTC ↗</a>` : '—'}</span><span class="num">${a && bal[a] != null ? btc(bal[a]) : w ? btc(w.balance_btc) : '—'}</span><span class="num mined">${ubtc(mined)}</span><span class="num">${h.shares || 0}</span><span class="h">${h.lastShare && h.lastShare.hash ? hz(h.lastShare.hash, 24) : '—'}</span><span class="addrline">${a || ''}</span></div>`;
    }).join('');
  const miners = hs.filter(h => !h.you); const sum = miners.reduce((s, h) => s + ((h.stat && h.stat.rate) || 0), 0);
  $('#kRate').textContent = rate(sum); $('#agMeta').textContent = fresh ? `${fresh.wallets.length} wallets · ${btc(fresh.wallets.reduce((s, w) => s + (bal[w.address] != null ? bal[w.address] : w.balance_btc), 0))} BTC held` : '—';
  $('#kShares').textContent = fmt(D.shareCount);
  const best = Math.max(0, ...D.humans.map(h => h.bestZ || 0)); $('#kBest').innerHTML = best ? `${best}<small>zero bits</small>` : '—';
  $('#kRig').textContent = rig.running ? rate(rig.stat && rig.stat.rate) : 'idle';
  $('#kRigSub').textContent = wallet.current ? (rig.running ? `target ${rig.stat && rig.stat.bits || '—'} bits · ${fmt(vault.of(wallet.current.address).shares)} shares` : 'press start rig below') : 'connect a wallet';
  $('#logMeta').textContent = `${fmt(D.shareCount)} shares`;
}
setInterval(agents, 1000);

/* ───────── ticker: deck shares + real blocks ───────── */
const tape = [];
function pushTape(html) { tape.unshift(html); tape.length = Math.min(tape.length, 14); $('#tick').innerHTML = tape.join('') + tape.join(''); }
addEventListener('deck:share', e => { const s = e.detail; pushTape(`<span><b>${s.name}</b>share for ${s.wallet ? short(s.wallet) : 'the hall'} ${hz(s.hash, 18)} <span class="dim">${s.zeros} bits</span></span>`); });
bus.on('share', s => pushTape(`<span><b>YOU</b>share ${hz(s.hash, 18)} <span class="z">+${ubtc(s.reward)} uBTC</span></span>`));
bus.on('claim', c => pushTape(`<span><b>YOU</b>drip · took ${c.choice === 'A' ? 'A only' : 'A + B'} · AI said ${c.pred === 'A' ? 'A only' : 'both'} <span class="z">+${ubtc(c.got)} uBTC</span></span>`));
chain.on('block', t => pushTape(`<span><b>BITCOIN</b>block #${fmt(t.height)}${t.pool ? ' · ' + t.pool : ''} <span class="z">drip open</span></span>`));

/* ───────── halving schedule ───────── */
function schedule() {
  const h = chain.tip ? chain.tip.height : 0, cur = era(h), rows = [];
  for (let e = 4; e <= 9; e++) {
    const k = Math.pow(2, 4 - e);
    rows.push(`<tr class="${e === cur ? 'now' : ''}"><td>${e}${e === cur ? '<span class="tag">now</span>' : ''}</td><td>#${fmt(e * HALVING)} – #${fmt((e + 1) * HALVING - 1)}</td><td>${ubtc(DRIP * k)}</td><td>${ubtc(OPEN_BOX * k)}</td><td>${ubtc(SHARE_PER_2_20 * k)}</td></tr>`);
  }
  const re = era(RELEASE_HEIGHT);
  rows.push(`<tr><td class="dim">…</td><td class="dim" colspan="4">${re - 9} more halvings</td></tr>`);
  rows.push(`<tr class="now"><td>${re}</td><td>#${fmt(RELEASE_HEIGHT)}<span class="tag">release</span></td><td colspan="3">every vault opens · around ${h ? release(h).eta.getFullYear() : 2326}</td></tr>`);
  $('#sched').innerHTML = rows.join('');
  $('#schedNow').textContent = h ? `now: era ${cur} · tip #${fmt(h)}` : '—';
}
schedule();

/* ───────── clock ───────── */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function clock() { const d = new Date(), p = n => String(n).padStart(2, '0'); $('#clock').textContent = `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}-${MON[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`; }
clock(); setInterval(clock, 15000);
setInterval(() => { chainBar(); blocks(); }, 15000);
vaultBlock(); chainBar(); blocks(); liveDot(chain.status);
initSources();
