/* faucet-ui.js — the faucet as three terminal panes (wallet/vault · drip · rig) plus the ledger.
   mountFaucet({ wallet, drip, rig, ledger }) fills the pane bodies; pane-bar meta goes in [data-fxbar=…]. */
import { chain, wallet, vault, rig, WALLETS, RELEASE_HEIGHT, DRIP, OPEN_BOX, eraFactor, release, fmt, ubtc, short, blockUrl, sha256hex, verifyShare } from './core.js';

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
        <p class="fxl">connect a bitcoin wallet. the faucet reads your <b>address</b> and nothing else; it never builds a transaction.</p>
        <div class="wl">${WALLETS.map(w => `<button data-w="${w.id}">${w.name}<em class="${w.has() ? 'ok' : ''}">${w.has() ? 'detected' : 'get ↗'}</em></button>`).join('')}</div>
        <form class="paste"><span class="chev">❯</span><input name="a" autocomplete="off" spellcheck="false" aria-label="Bitcoin address" placeholder="or mine to any address: bc1q… 1… 3…"><button>use</button></form>`;
      el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', async () => {
        b.classList.add('busy');
        try { await wallet.connect(b.dataset.w); toast('connected ' + short(addr())); }
        catch (e) { toast(e.message || 'connection rejected', true); }
        b.classList.remove('busy');
      }));
      el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); try { wallet.watch(e.target.a.value); toast('mining to ' + short(addr())); } catch (err) { toast(err.message, true); } });
      return;
    }
    const v = vault.of(a), h = tipH(), r = h ? release(h) : null, kind = wallet.current.kind;
    const wname = kind === 'address' ? 'pasted address' : (WALLETS.find(w => w.id === kind) || {}).name;
    bar('wallet', esc(short(a)));
    el.innerHTML = `
      <div class="vault"><span class="n">${ubtc(v.total)}</span><span class="u">uBTC</span></div>
      <dl class="rules">
        <dt>address</dt><dd><a href="https://mempool.space/address/${esc(a)}" target="_blank" rel="noopener">${esc(a)}</a></dd>
        <dt>via</dt><dd>${esc(wname || '')}</dd>
        <dt>locked until</dt><dd><a href="${blockUrl(RELEASE_HEIGHT)}" target="_blank" rel="noopener">#${fmt(RELEASE_HEIGHT)}</a></dd>
        <dt>blocks left</dt><dd>${r ? fmt(r.left) : '—'}</dd>
        <dt>years left</dt><dd>${r ? r.years.toFixed(5) : '—'}</dd>
        <dt>opens</dt><dd>${r ? MON[r.eta.getMonth()] + ' ' + r.eta.getFullYear() : '—'}</dd>
        <dt>drips · shares</dt><dd>${fmt(v.drips)} · ${fmt(v.shares)}</dd>
        <dt>signed</dt><dd>${v.sig ? `<span class="ok">yes</span>, at #${fmt(v.sig.height)}` : kind === 'address' ? '<span class="dim">pasted addresses cannot sign</span>' : '<span class="dim">not yet</span>'}</dd>
      </dl>
      <div class="pbar" title="progress to the release block"><i style="--p:${r ? r.pct : 0}%"></i></div>
      <div class="dim" style="font-size:12px">${r ? r.pct.toFixed(7) : '0'}% of the 300 years</div>
      <div class="fxrow">${kind !== 'address' && !v.sig ? '<button class="fxb" data-act="sign">sign vault</button>' : ''}<button class="fxb fxb--ghost" data-act="out">disconnect</button></div>`;
    el.querySelector('[data-act=out]').addEventListener('click', () => { wallet.disconnect(); toast('disconnected'); });
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
    if (!tip) { bar('drip', 'waiting for the tip'); el.innerHTML = `<p class="fxl">the drip opens on every new real bitcoin block. reading mempool.space…</p>`; return; }
    const k = eraFactor(tip.height);
    bar('drip', `block <a href="${blockUrl(tip.height)}" target="_blank" rel="noopener">#${fmt(tip.height)}</a> · ${ago(tip.time)} ago`);
    const claimed = a && vault.of(a).claims[tip.height];
    if (claimed) {
      const c = claimed, ok = await sha256hex(`${c.pred}|${c.secret}|${tip.height}|${a}`) === c.commit;
      el.innerHTML = `
        <div class="res ${c.got ? '' : 'dn'}">${c.got ? '+' + ubtc(c.got) + ' uBTC' : 'container A was empty'}</div>
        <p class="fxl">you took <b>${c.choice === 'A' ? 'A only' : 'A + B'}</b>. the onboard AI had predicted <b>${c.pred === 'A' ? 'A only' : 'both'}</b>, so A ${c.pred === 'A' ? `held ${fmt(DRIP * k)} uBTC` : 'was left empty'}.</p>
        <div class="proof2"><span class="k">sealed before you chose</span><code>${c.commit}</code>
          <span class="k">revealed</span><code>sha256("${c.pred}|${c.secret}|${tip.height}|${esc(a)}")</code>
          <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ matches the seal' : '✗ does not match'}</span></div>
        <p class="fxl" style="margin:12px 0 0">next drip: the next bitcoin block (~10 min). this one came ${ago(tip.time)} ago${tip.pool ? ' from ' + esc(tip.pool) : ''}.</p>`;
      return;
    }
    const v = a ? vault.of(a) : null;
    let seal = v && v.pending && v.pending.height === tip.height ? v.pending : null;
    if (a && !seal) { if (!sealing) sealing = vault.seal(a, tip.height).finally(() => (sealing = null)); seal = await sealing; }
    el.innerHTML = `
      <p class="fxl">the onboard AI has sealed its prediction. <b>A</b> holds ${fmt(DRIP * k)} uBTC only if it predicted you take A alone. <b>B</b> is open: ${fmt(OPEN_BOX * k)} uBTC.</p>
      <div class="boxes">
        <button class="box2" data-pick="A" ${a ? '' : 'disabled'}><span class="t">container A</span><span class="s">sealed</span><span class="a">${fmt(DRIP * k)} or 0</span><span class="c">take A only</span></button>
        <button class="box2" data-pick="AB" ${a ? '' : 'disabled'}><span class="t">A + B</span><span class="s">B is open</span><span class="a">${fmt(OPEN_BOX * k)} + A</span><span class="c">take both</span></button>
      </div>
      <p class="seal">${seal ? `seal <code>${seal.commit}</code>` : 'connect a wallet to open the drip'}</p>`;
    el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      const r = vault.claim(a, tip.height, b.dataset.pick);
      if (r) toast(r.got ? `+${ubtc(r.got)} uBTC into your vault` : 'container A was empty this block');
    }));
  }

  /* ── your rig ── */
  function renderRig() {
    const el = P.rig; const a = addr(), s = rig.stat, last = rig.last;
    bar('rig', rig.running ? '<span class="k">● mining</span>' : 'idle');
    el.innerHTML = `
      <p class="fxl">your browser runs double sha-256 over the live bitcoin tip, the same work a bitcoin miner does, against an easier target. every share lands in your vault.</p>
      <div class="fxrow" style="margin-top:0">
        <button class="fxb ${rig.running ? '' : 'fxb--leg'}" data-act="toggle" ${a ? '' : 'disabled'}>${rig.running ? 'stop rig' : 'start rig'}</button>
        <div class="seg" role="group" aria-label="power">${['low', 'mid', 'high'].map(p => `<button data-p="${p}" class="${rig.power === p ? 'on' : ''}">${p}</button>`).join('')}</div>
      </div>
      ${rig.elsewhere ? '<p class="fxl" style="margin:10px 0 0">your rig is already running in another tab.</p>' : ''}
      <dl class="rules" style="margin-top:12px">
        <dt>hashrate</dt><dd data-r="rate">${rig.running ? rate(s && s.rate) : '—'}</dd>
        <dt>target</dt><dd data-r="bits">${s && s.bits ? s.bits + ' zero bits' : '—'}</dd>
        <dt>hashes</dt><dd data-r="hashes">${s ? fmt(s.hashes) : '—'}</dd>
        <dt>shares</dt><dd>${a ? fmt(vault.of(a).shares) : '—'}</dd>
      </dl>
      <div class="hashbox"><span class="k">${last ? `last share · ${last.zeros} zero bits · +${ubtc(last.reward)} uBTC` : rig.running ? 'best hash this second' : 'hash'}</span>
        <code data-r="hash">${last ? hashHtml(last.hash) : s && s.best ? hashHtml(s.best) : '—'}</code>
        ${last ? `<button class="lnk" data-act="verify">check it with your browser's webcrypto</button> <span data-r="ver"></span>` : ''}</div>`;
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
      : `<div class="pane__body dim">${a ? 'claim a drip or start your rig. every entry links to the real bitcoin block it was mined on.' : 'connect a wallet. drips and shares show up here, each linked to its real bitcoin block.'}</div>`;
  }

  function all() { renderWallet(); renderDrip(); renderRig(); renderLedger(); }
  all();
  wallet.on('change', all);
  vault.on('change', () => { renderWallet(); renderDrip(); renderLedger(); patchRig(); });
  chain.on('tip', () => { renderWallet(); renderDrip(); });
  rig.on('state', renderRig); rig.on('share', renderRig); rig.on('stat', patchRig);
  setInterval(() => { if (chain.tip) bar('drip', `block <a href="${blockUrl(chain.tip.height)}" target="_blank" rel="noopener">#${fmt(chain.tip.height)}</a> · ${ago(chain.tip.time)} ago`); }, 10000);
}
