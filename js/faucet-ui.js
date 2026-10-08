/* faucet-ui.js — the faucet as three terminal panes (wallet/vault · drip · rig) plus the ledger.
   mountFaucet({ wallet, drip, rig, ledger }) fills the pane bodies; pane-bar meta goes in [data-fxbar=…]. */
import { openConnect } from './connect.js';
import { chain, wallet, vault, rig, balance, RELEASE_HEIGHT, DRIP, OPEN_BOX, eraFactor, release, fmt, ubtc, short, blockUrl, sha256hex, verifyShare } from './core.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? Math.round(s) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : (s / 3600).toFixed(1) + 'h'; };
const rate = r => !r ? '—' : r >= 1e6 ? (r / 1e6).toFixed(2) + ' MH/s' : (r / 1e3).toFixed(0) + ' kH/s';
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const hashHtml = h => { const m = /^0*/.exec(h)[0]; return `<span class="z">${m}</span>${h.slice(m.length)}`; };
const hhmm = t => new Date(t).toTimeString().slice(0, 5);

let toastEl;
export function toast(msg, bad) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'fxtoast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.className = 'fxtoast on' + (bad ? ' bad' : ''); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => (toastEl.className = 'fxtoast'), 4200);
}

export function mountFaucet(P) {
  Object.values(P).forEach(el => el && el.classList.add('fx'));
  const bar = (k, html) => document.querySelectorAll(`[data-fxbar=${k}]`).forEach(e => (e.innerHTML = html));
  const addr = () => wallet.current && wallet.current.address;
  const tipH = () => (chain.tip ? chain.tip.height : null);

  /* ── wallet / vault ── */
  function renderWallet() {
    const el = P.wallet; const a = addr();
    if (!a) {
      bar('wallet', 'not connected');
      el.innerHTML = `
        <p class="fxl">Connect a Bitcoin wallet. The faucet reads your <b>address</b> and nothing else, and never builds a transaction.</p>
        <div class="wl">${wallet.list().slice(0, 6).map(w => `<button data-w="${w.id}">${w.name}<em class="${w.has() ? 'ok' : ''}">${w.has() ? 'Detected' : 'Get ↗'}</em></button>`).join('')}</div>
        <button class="fxb fxb--leg fx-connect" data-act="connect">Connect wallet</button>
        <form class="paste"><span class="chev">❯</span><input name="a" autocomplete="off" spellcheck="false" aria-label="Bitcoin address" placeholder="or paste any address: bc1q… 1… 3…"><button>Use</button></form>`;
      el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => openConnect(b.dataset.w)));
      el.querySelector('[data-act=connect]').addEventListener('click', () => openConnect());
      el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); try { wallet.watch(e.target.a.value); toast('Mining to ' + short(addr())); } catch (err) { toast(err.message, true); } });
      return;
    }
    const v = vault.of(a), h = tipH(), r = h ? release(h) : null, kind = wallet.current.kind;
    const wname = kind === 'address' ? 'pasted address' : (wallet.current.name || (wallet.find(kind) || {}).name || kind);
    bar('wallet', esc(short(a)));
    el.innerHTML = `
      <div class="vault"><span class="n">${ubtc(v.total)}</span><span class="u">uBTC</span></div>
      <dl class="rules">
        <dt>Address</dt><dd><a href="https://mempool.space/address/${esc(a)}" target="_blank" rel="noopener">${esc(a)}</a></dd>
        <dt>Via</dt><dd>${esc(wname || '')}${wallet.current.type ? ' · ' + esc(wallet.current.type) : ''}</dd>
        <dt>On-chain</dt><dd>${balance.addr === a && balance.btc != null ? balance.btc.toFixed(8) + ' BTC' : 'reading…'}</dd>
        <dt>Locked until</dt><dd><a href="${blockUrl(RELEASE_HEIGHT)}" target="_blank" rel="noopener">#${fmt(RELEASE_HEIGHT)}</a></dd>
        <dt>Blocks left</dt><dd>${r ? fmt(r.left) : '—'}</dd>
        <dt>Years left</dt><dd>${r ? r.years.toFixed(5) : '—'}</dd>
        <dt>Opens</dt><dd>${r ? MON[r.eta.getMonth()] + ' ' + r.eta.getFullYear() : '—'}</dd>
        <dt>Drips · shares</dt><dd>${fmt(v.drips)} · ${fmt(v.shares)}</dd>
        <dt>Signed</dt><dd>${v.sig ? `<span class="ok">yes</span>, at #${fmt(v.sig.height)}` : kind === 'address' ? '<span class="dim">pasted addresses cannot sign</span>' : '<span class="dim">not yet</span>'}</dd>
      </dl>
      <div class="pbar" title="progress to the release block"><i style="--p:${r ? r.pct : 0}%"></i></div>
      <div class="dim" style="font-size:12px">${r ? r.pct.toFixed(7) : '0'}% of the 300 years</div>
      <div class="fxrow">${kind !== 'address' && !v.sig ? '<button class="fxb" data-act="sign">Sign vault</button>' : ''}<button class="fxb fxb--ghost" data-act="out">Disconnect</button></div>`;
    el.querySelector('[data-act=out]').addEventListener('click', () => { wallet.disconnect(); toast('Disconnected'); });
    const sb = el.querySelector('[data-act=sign]');
    if (sb) sb.addEventListener('click', async () => {
      const height = tipH(); const msg = `Ultrabitcoin vault\naddress: ${a}\nbalance: ${ubtc(v.total)} uBTC\nrelease block: ${RELEASE_HEIGHT}\nsigned at block: ${height}`;
      try { const sig = await wallet.sign(msg); if (!sig) throw new Error('no signature returned'); v.sig = { sig, msg, height }; vault.save(a); toast('vault signed (a message, no transaction)'); }
      catch (e) { toast(e.message || 'signature rejected', true); }
    });
  }

  /* ── the drip: Newcomb's two containers, once per real Bitcoin block ── */
  let sealing = null;
  async function renderDrip() {
    const el = P.drip; const a = addr(), tip = chain.tip;
    if (!tip) { bar('drip', 'waiting for the tip'); el.innerHTML = `<p class="fxl">The drip opens on every new real Bitcoin block. Reading mempool.space…</p>`; return; }
    const k = eraFactor(tip.height);
    bar('drip', `block <a href="${blockUrl(tip.height)}" target="_blank" rel="noopener">#${fmt(tip.height)}</a> · ${ago(tip.time)} ago`);
    const claimed = a && vault.of(a).claims[tip.height];
    if (claimed) {
      const c = claimed, ok = await sha256hex(`${c.pred}|${c.secret}|${tip.height}|${a}`) === c.commit;
      el.innerHTML = `
        <div class="res ${c.got ? '' : 'dn'}">${c.got ? '+' + ubtc(c.got) + ' uBTC' : 'Container A was empty'}</div>
        <p class="fxl">You took <b>${c.choice === 'A' ? 'A only' : 'A + B'}</b>. The onboard AI had predicted <b>${c.pred === 'A' ? 'A only' : 'both'}</b>, so A ${c.pred === 'A' ? `held ${fmt(DRIP * k)} uBTC` : 'was left empty'}.</p>
        <div class="proof2"><span class="k">Sealed before you chose</span><code>${c.commit}</code>
          <span class="k">Revealed</span><code>sha256("${c.pred}|${c.secret}|${tip.height}|${esc(a)}")</code>
          <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ Matches the seal' : '✗ Does not match'}</span></div>
        <p class="fxl" style="margin:12px 0 0">Next drip: the next Bitcoin block, about 10 minutes. This one came ${ago(tip.time)} ago${tip.pool ? ' from ' + esc(tip.pool) : ''}.</p>`;
      return;
    }
    const v = a ? vault.of(a) : null;
    let seal = v && v.pending && v.pending.height === tip.height ? v.pending : null;
    if (a && !seal) { if (!sealing) sealing = vault.seal(a, tip.height).finally(() => (sealing = null)); seal = await sealing; }
    el.innerHTML = `
      <p class="fxl">The onboard AI has sealed its prediction. <b>A</b> holds ${fmt(DRIP * k)} uBTC only if it predicted you take A alone. <b>B</b> is open: ${fmt(OPEN_BOX * k)} uBTC.</p>
      <div class="boxes">
        <button class="box2" data-pick="A" ${a ? '' : 'disabled'}><span class="t">Container A</span><span class="s">sealed</span><span class="a">${fmt(DRIP * k)} or 0</span><span class="c">Take A only</span></button>
        <button class="box2" data-pick="AB" ${a ? '' : 'disabled'}><span class="t">A + B</span><span class="s">B is open</span><span class="a">${fmt(OPEN_BOX * k)} + A</span><span class="c">Take both</span></button>
      </div>
      <p class="seal">${seal ? `Seal <code>${seal.commit}</code>` : 'Connect a wallet to open the drip'}</p>`;
    el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      const r = vault.claim(a, tip.height, b.dataset.pick);
      if (r) toast(r.got ? `+${ubtc(r.got)} uBTC into your vault` : 'Container A was empty this block');
    }));
  }

  /* ── your rig ── */
  function renderRig() {
    const el = P.rig; const a = addr(), s = rig.stat, last = rig.last;
    bar('rig', rig.running ? '<span class="z">mining</span>' : 'idle');
    el.innerHTML = `
      <p class="fxl">Your browser runs double SHA-256 over the live Bitcoin tip, the same work a Bitcoin miner does, against an easier target. Every share lands in your vault.</p>
      <div class="fxrow" style="margin-top:0">
        <button class="fxb ${rig.running ? '' : 'fxb--leg'}" data-act="toggle" ${a ? '' : 'disabled'}>${rig.running ? 'Stop rig' : 'Start rig'}</button>
        <div class="seg" role="group" aria-label="power">${['low', 'mid', 'high'].map(p => `<button data-p="${p}" class="${rig.power === p ? 'on' : ''}">${p}</button>`).join('')}</div>
      </div>
      ${rig.elsewhere ? '<p class="fxl" style="margin:10px 0 0">Your rig is already running in another tab.</p>' : ''}
      <dl class="rules" style="margin-top:12px">
        <dt>Hashrate</dt><dd data-r="rate">${rig.running ? rate(s && s.rate) : '—'}</dd>
        <dt>Target</dt><dd data-r="bits">${s && s.bits ? s.bits + ' zero bits' : '—'}</dd>
        <dt>Hashes</dt><dd data-r="hashes">${s ? fmt(s.hashes) : '—'}</dd>
        <dt>Shares</dt><dd>${a ? fmt(vault.of(a).shares) : '—'}</dd>
      </dl>
      <div class="hashbox"><span class="k">${last ? `Last share · ${last.zeros} zero bits · +${ubtc(last.reward)} uBTC` : rig.running ? 'Best hash this second' : 'Hash'}</span>
        <code data-r="hash">${last ? hashHtml(last.hash) : s && s.best ? hashHtml(s.best) : '—'}</code>
        ${last ? `<button class="lnk" data-act="verify">Check it with your browser's WebCrypto</button> <span data-r="ver"></span>` : ''}</div>`;
    el.querySelector('[data-act=toggle]').addEventListener('click', () => (rig.running ? rig.stop() : rig.start()));
    el.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => rig.setPower(b.dataset.p)));
    const vb = el.querySelector('[data-act=verify]');
    if (vb) vb.addEventListener('click', async () => { const h = await verifyShare(last.header); const o = el.querySelector('[data-r=ver]'); o.textContent = h === last.hash ? '✓ same hash' : '✗ ' + h.slice(0, 16); o.className = h === last.hash ? 'ok' : 'bad'; });
  }
  function patchRig() {
    const el = P.rig; const s = rig.stat; const q = k => el.querySelector(`[data-r=${k}]`); if (!q('rate')) return renderRig();
    q('rate').textContent = rig.running ? rate(s && s.rate) : '—'; q('bits').textContent = s && s.bits ? s.bits + ' zero bits' : '—'; q('hashes').textContent = s ? fmt(s.hashes) : '—';
    if (!rig.last && s && s.best) q('hash').innerHTML = hashHtml(s.best);
  }

  /* ── ledger ── */
  function renderLedger() {
    if (!P.ledger) return; const a = addr(); const L = a ? vault.of(a).ledger.slice(0, 40) : [];
    bar('ledger', a ? `${fmt(L.length)} entries · ${ubtc(vault.of(a).total)} uBTC` : '—');
    P.ledger.innerHTML = L.length ? `<ul class="led">${L.map(e => `<li><span class="t">${hhmm(e.at)}</span><span class="kind ${e.kind}">${e.kind === 'drip' ? (e.choice === 'A' ? 'drip · took A' : 'drip · took A+B') + (e.amount ? '' : ' · empty') : 'share · ' + e.zeros + ' bits'}</span><a href="${blockUrl(e.height)}" target="_blank" rel="noopener">#${fmt(e.height)}</a><span class="amt">+${ubtc(e.amount)}</span></li>`).join('')}</ul>`
      : `<div class="pane__body dim">${a ? 'Claim a drip or start your rig. Every entry links to the real Bitcoin block it was mined on.' : 'Connect a wallet. Drips and shares show up here, each linked to its real Bitcoin block.'}</div>`;
  }

  function all() { renderWallet(); renderDrip(); renderRig(); renderLedger(); }
  all();
  wallet.on('change', all); balance.on('change', renderWallet);
  vault.on('change', () => { renderWallet(); renderDrip(); renderLedger(); patchRig(); });
  chain.on('tip', () => { renderWallet(); renderDrip(); });
  rig.on('state', renderRig); rig.on('share', renderRig); rig.on('stat', patchRig);
  setInterval(() => { if (chain.tip) bar('drip', `block <a href="${blockUrl(chain.tip.height)}" target="_blank" rel="noopener">#${fmt(chain.tip.height)}</a> · ${ago(chain.tip.time)} ago`); }, 10000);
}
