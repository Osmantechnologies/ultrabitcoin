/* app.js — the light Ultrabitcoin page: hero chips, hall KPIs, ticker, faucet, the seven fresh wallets, live blocks,
   halving table, live sources. The hall itself is sandbox.js; the faucet cards are faucet-ui.js. */
import { chain, wallet, vault, rig, bus, RELEASE_HEIGHT, HALVING, DRIP, OPEN_BOX, SHARE_PER_2_20, EVAL_URL, era, eraFactor, nextHalving, release, fmt, ubtc, short, blockUrl, timeout } from './core.js';
import { mountFaucet } from './faucet-ui.js';
import './sandbox.js';
import { initSources } from './github.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : (s / 3600).toFixed(1) + 'h'; };
const rate = r => !r ? '—' : r >= 1e6 ? (r / 1e6).toFixed(2) + ' MH/s' : (r / 1e3).toFixed(0) + ' kH/s';
const hz = (h, n = 20) => { const m = /^0*/.exec(h)[0]; return `<span class="z">${m}</span>${h.slice(m.length, n)}…`; };
const btc = v => (v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(4) : v.toFixed(6)) + ' BTC';

$('#evalLink').href = EVAL_URL;
$('#cRel').href = blockUrl(RELEASE_HEIGHT);
fetch('version.txt', { cache: 'no-store' }).then(r => r.text()).then(v => ($('#ver').textContent = 'v' + v.trim())).catch(() => { });
const top = $('#top'); const onScroll = () => top.classList.toggle('scrolled', scrollY > 20); addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* ───────── faucet ───────── */
mountFaucet({ wallet: $('#fxWallet'), drip: $('#fxDrip'), rig: $('#fxRig'), ledger: $('#fxLedger') });

/* ───────── chain: hero chips, kpis, status ───────── */
function chainBits() {
  const t = chain.tip; if (!t) return;
  const c = $('#cTip'); c.href = blockUrl(t.height); c.querySelector('.v').innerHTML = `#${fmt(t.height)}<small>${ago(t.time)} ago</small>`;
  $('#cHalv').innerHTML = `#${fmt(nextHalving(t.height))}<small>${fmt(nextHalving(t.height) - t.height)} blocks</small>`;
  $('#cDrip').innerHTML = `${fmt(DRIP * eraFactor(t.height))}<small>uBTC</small>`;
  $('#bubbleTip').textContent = 'block #' + fmt(t.height);
  const r = release(t.height);
  $('#kLeft').textContent = fmt(r.left); $('#kLeftSub').textContent = `${r.years.toFixed(3)} years · #${fmt(RELEASE_HEIGHT)}`;
  $('#kEra').innerHTML = `${era(t.height)}<small>· ${fmt(DRIP * eraFactor(t.height))} uBTC</small>`; $('#kEraSub').textContent = `halves at #${fmt(nextHalving(t.height))}`;
}
function liveDot(s) {
  const el = $('#liveDot'); const live = s === 'live';
  el.classList.toggle('on', live); el.querySelector('span').textContent = live ? 'Live Bitcoin' : s === 'cached' ? 'Cached tip' : s === 'offline' ? 'Offline' : 'Connecting';
  $('#chainStatus').textContent = live ? 'mempool.space · live' : s;
}
function connectChip() { const c = wallet.current; $('#connectChip').textContent = c ? short(c.address) + ' · ' + ubtc(vault.of(c.address).total) + ' uBTC' : 'Connect wallet'; }
chain.on('tip', () => { chainBits(); blocks(); schedule(); });
chain.on('status', liveDot);
wallet.on('change', connectChip); vault.on('change', connectChip);

/* ───────── live blocks ───────── */
let topH = 0;
function blocks() {
  const list = chain.blocks.slice(0, 8); if (!list.length) return;
  $('#blocks').innerHTML = list.map(b => `<div class="blk ${topH && b.height > topH ? 'new' : ''}"><a href="${blockUrl(b.height)}" target="_blank" rel="noopener">#${fmt(b.height)}</a><span class="p">${esc(b.pool || '—')} · ${fmt(b.txs || 0)} transactions</span><span class="a">${ago(b.time)} ago</span></div>`).join('');
  topH = list[0].height;
}

/* ───────── hall kpis (read from the deck) ───────── */
function kpis() {
  const D = window.__DECK; if (!D) return;
  const miners = D.humans.filter(h => !h.ai && !h.you);
  $('#kRate').textContent = rate(miners.reduce((s, h) => s + ((h.stat && h.stat.rate) || 0), 0));
  $('#kShares').textContent = fmt(D.shareCount);
  const best = Math.max(0, ...D.humans.map(h => h.bestZ || 0)); $('#kBest').innerHTML = best ? `${best}<small>bits</small>` : '—';
  $('#kRig').textContent = rig.running ? rate(rig.stat && rig.stat.rate) : 'idle';
  $('#kRigSub').textContent = wallet.current ? (rig.running ? `${fmt(vault.of(wallet.current.address).shares)} shares so far` : 'press Start rig below') : 'connect a wallet';
  $('#logMeta').textContent = `${fmt(D.shareCount)} shares`;
  walletsLive(D);
}
setInterval(kpis, 1000);

/* ───────── the seven fresh wallets ───────── */
let fresh = null; const bal = {};
async function loadFresh() {
  try { fresh = await (await fetch('data/fresh-wallets.json', { cache: 'no-store' })).json(); } catch { return; }
  const D = () => window.__DECK;
  const agentOf = a => D() && D().humans.find(h => h.wallet === a);
  $('#wgrid').innerHTML = fresh.wallets.map((w, i) => `
    <div class="card wcard" data-w="${w.address}">
      <div class="wtop"><img src="img/agent-icon.png" alt=""><div><b data-name>agent ${i + 1}</b><span data-note>mining for</span></div><div class="mined"><b data-mined>0</b><br><span>uBTC mined</span></div></div>
      <div class="waddr"><a href="https://mempool.space/address/${w.address}" target="_blank" rel="noopener">${w.address}</a><button data-copy="${w.address}">Copy</button></div>
      <div class="wfacts">
        <div><span class="k">First funded</span><span class="v">${w.first_funded.slice(11, 16)} UTC <span class="dim">${w.first_funded.slice(5, 10)}</span></span></div>
        <div><span class="k">Received</span><span class="v">${btc(w.funded_btc)}</span></div>
        <div><span class="k">Holding now</span><span class="v" data-bal>${btc(w.balance_btc)}</span></div>
        <div><span class="k">Hall shares</span><span class="v" data-shares>0</span></div>
      </div>
      <div class="wlast" data-last><a class="u" href="https://mempool.space/tx/${w.first_txid}" target="_blank" rel="noopener">first funding tx ${w.first_txid.slice(0, 10)}…</a></div>
    </div>`).join('');
  $('#wnote').innerHTML = `Picked ${fresh.fetched_at.slice(0, 16).replace('T', ' ')} UTC at Bitcoin block #${fmt(fresh.tip)}, from mempool.space: first transaction confirmed under 24 hours earlier, at least 0.02 BTC received, still holding coins. These are strangers' wallets; the agents mine uBTC in their name and nothing is ever sent to them. "Holding now" updates live.`;
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; } catch { b.textContent = 'Select it'; } setTimeout(() => (b.textContent = 'Copy'), 1400); }));
  refreshBalances(); setInterval(refreshBalances, 120000);
}
async function refreshBalances() {
  if (!fresh) return;
  for (const w of fresh.wallets) {
    try {
      const r = await timeout(fetch(`https://mempool.space/api/address/${w.address}`), 8000); if (!r.ok) continue;
      const d = await r.json(); const c = d.chain_stats, m = d.mempool_stats;
      bal[w.address] = (c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum) / 1e8;
    } catch { }
    await new Promise(r => setTimeout(r, 250));
  }
}
function walletsLive(D) {
  if (!fresh) return;
  document.querySelectorAll('.wcard').forEach(card => {
    const a = card.dataset.w; const h = D.humans.find(x => x.wallet === a); if (!h) return;
    card.querySelector('[data-name]').textContent = h.label; card.querySelector('[data-note]').textContent = h.note;
    card.querySelector('[data-mined]').textContent = ubtc(h.mined || 0);
    card.querySelector('[data-shares]').textContent = fmt(h.shares || 0);
    if (bal[a] != null) card.querySelector('[data-bal]').textContent = btc(bal[a]);
    if (h.lastShare && h.lastShare.hash) card.querySelector('[data-last]').innerHTML = `last share ${hz(h.lastShare.hash, 30)} · ${h.lastShare.zeros} bits`;
  });
}
loadFresh();

/* ───────── ticker ───────── */
const tape = [];
function pushTape(html) { tape.unshift(html); tape.length = Math.min(tape.length, 14); $('#tick').innerHTML = tape.join('') + tape.join(''); }
addEventListener('deck:share', e => { const s = e.detail; pushTape(`<span><b>${s.name}</b>share for ${s.wallet ? short(s.wallet) : 'the hall'} <code>${hz(s.hash, 16)}</code> ${s.zeros} bits</span>`); });
bus.on('share', s => pushTape(`<span><b>You</b>share <code>${hz(s.hash, 16)}</code> <span class="z">+${ubtc(s.reward)} uBTC</span></span>`));
bus.on('claim', c => pushTape(`<span><b>You</b>took ${c.choice === 'A' ? 'container A' : 'both containers'} <span class="z">+${ubtc(c.got)} uBTC</span></span>`));
chain.on('block', t => pushTape(`<span><b>Bitcoin</b>block #${fmt(t.height)}${t.pool ? ' by ' + esc(t.pool) : ''} · <span class="z">the drip is open</span></span>`));

/* ───────── halving ───────── */
function schedule() {
  const h = chain.tip ? chain.tip.height : 0, cur = era(h), rows = [];
  for (let e = 4; e <= 9; e++) {
    const k = Math.pow(2, 4 - e);
    rows.push(`<tr class="${e === cur ? 'now' : ''}"><td>${e}${e === cur ? '<span class="tag">now</span>' : ''}</td><td>#${fmt(e * HALVING)} – #${fmt((e + 1) * HALVING - 1)}</td><td>${ubtc(DRIP * k)}</td><td>${ubtc(OPEN_BOX * k)}</td><td class="hide-s">${ubtc(SHARE_PER_2_20 * k)}</td></tr>`);
  }
  const re = era(RELEASE_HEIGHT);
  rows.push(`<tr><td class="dim">…</td><td class="dim" colspan="4">${re - 9} more halvings</td></tr>`);
  rows.push(`<tr class="now"><td>${re}</td><td>#${fmt(RELEASE_HEIGHT)}<span class="tag">release</span></td><td colspan="3">Every vault opens · around ${h ? release(h).eta.getFullYear() : 2326}</td></tr>`);
  $('#sched').innerHTML = rows.join('');
  $('#schedNow').textContent = h ? `now: era ${cur} · tip #${fmt(h)}` : '—';
}
schedule();

/* ───────── reveals ───────── */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

setInterval(() => { chainBits(); blocks(); }, 15000);
chainBits(); blocks(); liveDot(chain.status); connectChip();
initSources();
