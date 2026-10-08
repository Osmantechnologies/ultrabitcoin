/* connect.js — the Bitcoin wallet connector: modal (wallet list → approve → pick an address), the connected chip in
   the top bar with its account menu, and a phone fallback. Read-only: it only ever asks a wallet for addresses and,
   if you choose, a plain signed message for your vault. */
import { wallet, balance, vault, RELEASE_HEIGHT, short, ubtc, fmt, addrType } from './core.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = n => n.replace(/wallet/i, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const hue = n => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const icon = w => { const src = w.icon && w.icon(); return src ? `<img src="${esc(src)}" alt="">` : `<b style="--h:${hue(w.name)}">${esc(initials(w.name))}</b>`; };
const touch = matchMedia('(pointer: coarse)').matches;
const btc = v => v == null ? '…' : v >= 1 ? v.toFixed(3) : v >= 0.001 ? v.toFixed(5) : v.toFixed(8);

let el, state = { view: 'list' }, lastFocus = null, onDone = null;

function mount() {
  if (el) return el;
  el = document.createElement('div'); el.className = 'cx'; el.hidden = true;
  el.innerHTML = `<div class="cx__scrim" data-close></div>
    <div class="cx__card" role="dialog" aria-modal="true" aria-labelledby="cxTitle">
      <div class="cx__bar"><span class="chev">❯</span><span id="cxTitle">connect a bitcoin wallet</span><button class="cx__x" data-close aria-label="Close">×</button></div>
      <div class="cx__body"></div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  return el;
}
function close() { if (!el) return; el.hidden = true; document.body.classList.remove('cx-open'); state = { view: 'list' }; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

export function openConnect(id) {
  mount(); lastFocus = document.activeElement; el.hidden = false; document.body.classList.add('cx-open');
  if (id) start(id); else { state = { view: 'list' }; render(); }
}

async function start(id) {
  const w = wallet.find(id); if (!w) return;
  if (!w.has()) { state = { view: 'error', w, msg: `${w.name} is not installed in this browser.`, install: w.site }; render(); return; }
  state = { view: 'busy', w }; render();
  const ticket = state;
  try {
    const list = await wallet.accounts(id);
    if (state !== ticket) return;   // cancelled meanwhile
    if (list.length === 1) { finish(w, list[0]); return; }
    state = { view: 'pick', w, list, sel: Math.max(0, list.findIndex(a => a.purpose === 'payment')) }; render();
  } catch (e) {
    if (state !== ticket) return;
    state = { view: 'error', w, msg: e.message, install: e.install }; render();
  }
}
function finish(w, a) {
  wallet.use(w.id, a); close(); toast(`Connected ${w.name} · ${short(a.address)}`);
  const f = document.getElementById('faucet'); if (f && location.hash !== '#faucet' && !onDone) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function render() {
  const body = el.querySelector('.cx__body'), title = el.querySelector('#cxTitle');
  const s = state;
  if (s.view === 'list') {
    title.textContent = 'connect a bitcoin wallet';
    const list = wallet.list(); const any = list.some(w => w.has());
    body.innerHTML = `
      <p class="cx__p">Pick the wallet that holds your address. The faucet reads your address and nothing else: it never builds a transaction.</p>
      <ul class="cx__list">${list.map(w => `<li><button class="cx__w" data-w="${esc(w.id)}"><span class="cx__ic">${icon(w)}</span><span class="cx__n">${esc(w.name)}</span><span class="cx__tag ${w.has() ? 'ok' : ''}">${w.has() ? 'detected' : 'install ↗'}</span></button></li>`).join('')}</ul>
      ${!any ? `<div class="cx__note">${touch ? `On a phone? Wallet extensions live inside wallet apps. Open <b>${esc(location.host || 'this page')}</b> in the browser inside Xverse, UniSat or OKX, or paste an address below. <button class="cx__copy" data-copy-link>copy link</button>` : 'No Bitcoin wallet extension found in this browser. Install one above, or paste an address below.'}</div>` : ''}
      <form class="cx__paste"><label for="cxAddr">or mine to any Bitcoin address</label><div><input id="cxAddr" name="a" autocomplete="off" spellcheck="false" placeholder="bc1q… / bc1p… / 1… / 3…"><button>use</button></div></form>`;
    body.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => start(b.dataset.w)));
    body.querySelector('form').addEventListener('submit', e => { e.preventDefault(); try { wallet.watch(e.target.a.value); close(); toast('Mining to ' + short(wallet.current.address)); } catch (err) { const i = e.target.a; i.setCustomValidity(err.message); i.reportValidity(); setTimeout(() => i.setCustomValidity(''), 2500); } });
    const cl = body.querySelector('[data-copy-link]'); if (cl) cl.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href.split('#')[0]); cl.textContent = 'copied'; } catch { cl.textContent = location.href; } });
    const first = body.querySelector('.cx__w'); if (first) first.focus();
  } else if (s.view === 'busy') {
    title.textContent = 'approve in ' + s.w.name.toLowerCase();
    body.innerHTML = `<div class="cx__busy"><span class="cx__ic cx__ic--lg">${icon(s.w)}</span><h3>Approve the request in ${esc(s.w.name)}</h3><p class="cx__p">Your wallet is asking to share your Bitcoin address with this page. That is all it shares.</p><div class="cx__spin"><i></i></div><button class="cx__ghost" data-back>back</button></div>`;
    body.querySelector('[data-back]').addEventListener('click', () => { state = { view: 'list' }; render(); });
  } else if (s.view === 'pick') {
    title.textContent = 'choose the address that mines';
    body.innerHTML = `<p class="cx__p">${esc(s.w.name)} has ${s.list.length} addresses. Your uBTC vault belongs to the one you pick.</p>
      <div class="cx__pick" role="radiogroup">${s.list.map((a, i) => `<button role="radio" aria-checked="${i === s.sel}" class="cx__a ${i === s.sel ? 'on' : ''}" data-i="${i}"><span class="cx__r"></span><span><b>${esc(a.purpose === 'ordinals' ? 'ordinals' : 'payment')}</b> · ${esc(a.type)}<code>${esc(a.address)}</code></span></button>`).join('')}</div>
      <button class="cx__go" data-use>use this address</button>`;
    body.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { s.sel = +b.dataset.i; render(); }));
    body.querySelector('[data-use]').addEventListener('click', () => finish(s.w, s.list[s.sel]));
    body.querySelector('.cx__a.on').focus();
  } else if (s.view === 'error') {
    title.textContent = s.install ? s.w.name.toLowerCase() + ' not found' : 'not connected';
    body.innerHTML = `<div class="cx__busy"><span class="cx__ic cx__ic--lg">${icon(s.w)}</span><h3>${esc(s.msg)}</h3>
      <div class="cx__row">${s.install ? `<a class="cx__go" href="${esc(s.install)}" target="_blank" rel="noopener">get ${esc(s.w.name)} ↗</a>` : `<button class="cx__go" data-retry>try again</button>`}<button class="cx__ghost" data-back>other wallets</button></div></div>`;
    const r = body.querySelector('[data-retry]'); if (r) r.addEventListener('click', () => start(s.w.id));
    body.querySelector('[data-back]').addEventListener('click', () => { state = { view: 'list' }; render(); });
  }
}

/* ───────── the connected chip + account menu ───────── */
let menu;
export function mountChip(chip) {
  if (!chip) return;
  const paint = () => {
    const c = wallet.current;
    if (!c) { chip.classList.remove('is-on'); chip.innerHTML = 'connect wallet'; return; }
    const v = vault.of(c.address);
    chip.classList.add('is-on');
    chip.innerHTML = `<i class="cxdot"></i><span class="cxc__n">${esc(c.name || c.kind)}</span><span class="cxc__a">${esc(short(c.address))}</span><span class="cxc__b">${balance.addr === c.address ? btc(balance.btc) + ' BTC' : '… BTC'}</span><span class="cxc__u">${ubtc(v.total)} uBTC</span>`;
  };
  chip.addEventListener('click', e => {
    e.preventDefault();
    if (!wallet.current) { openConnect(); return; }
    toggleMenu(chip);
  });
  wallet.on('change', () => { paint(); if (menu && !menu.hidden) buildMenu(); }); balance.on('change', paint); vault.on('change', paint); paint();
  document.addEventListener('click', e => { if (menu && !menu.hidden && !e.target.closest('.cxm') && !e.target.closest('#' + chip.id)) menu.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu) menu.hidden = true; });
}
function toggleMenu(chip) {
  if (!menu) { menu = document.createElement('div'); menu.className = 'cxm'; menu.hidden = true; document.body.appendChild(menu); }
  if (!menu.hidden) { menu.hidden = true; return; }
  buildMenu(); const r = chip.getBoundingClientRect(); menu.style.top = (r.bottom + 6) + 'px'; menu.style.right = Math.max(8, innerWidth - r.right) + 'px'; menu.hidden = false;
}
function buildMenu() {
  const c = wallet.current; if (!c) { menu.hidden = true; return; }
  const v = vault.of(c.address), canSign = c.kind !== 'address' && !v.sig;
  menu.innerHTML = `
    <div class="cxm__hd"><span class="cxm__n">${esc(c.name || c.kind)} · ${esc(c.purpose || 'payment')} · ${esc(c.type || addrType(c.address))}</span><code>${esc(c.address)}</code></div>
    <dl class="cxm__dl"><dt>on-chain</dt><dd>${balance.addr === c.address ? btc(balance.btc) + ' BTC' : 'reading…'}</dd><dt>uBTC vault</dt><dd>${ubtc(v.total)} · opens #${fmt(RELEASE_HEIGHT)}</dd><dt>signed</dt><dd>${v.sig ? 'yes' : c.kind === 'address' ? 'pasted address' : 'not yet'}</dd></dl>
    <button data-m="copy">copy address</button>
    <a data-m="mempool" href="https://mempool.space/address/${esc(c.address)}" target="_blank" rel="noopener">view on mempool.space ↗</a>
    ${canSign ? '<button data-m="sign">sign vault (a message, no transaction)</button>' : ''}
    <button data-m="switch">switch wallet</button>
    <button data-m="out" class="cxm__out">disconnect</button>`;
  menu.querySelector('[data-m=copy]').addEventListener('click', async e => { try { await navigator.clipboard.writeText(c.address); e.target.textContent = 'copied'; } catch { e.target.textContent = 'select it above'; } });
  const sg = menu.querySelector('[data-m=sign]'); if (sg) sg.addEventListener('click', async () => {
    const msg = `Ultrabitcoin vault\naddress: ${c.address}\nbalance: ${ubtc(v.total)} uBTC\nrelease block: ${RELEASE_HEIGHT}`;
    try { const sig = await wallet.sign(msg); if (!sig) throw new Error('No signature returned'); v.sig = { sig, msg, height: null }; vault.save(c.address); toast('Vault signed'); buildMenu(); } catch (e) { toast(e.message, true); }
  });
  menu.querySelector('[data-m=switch]').addEventListener('click', () => { menu.hidden = true; openConnect(); });
  menu.querySelector('[data-m=out]').addEventListener('click', () => { menu.hidden = true; wallet.disconnect(); toast('Disconnected'); });
}

let toastEl;
function toast(msg, bad) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'fxtoast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.className = 'fxtoast on' + (bad ? ' bad' : ''); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.className = 'fxtoast'), 4200);
}
