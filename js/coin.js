/* coin.js — $uBTC (Ultra Bitcoin), the pump.fun coin: copy buttons and a live market cap from DexScreener (CORS *).
   Its creator fees go into locking BTC for 300 years (the vault in the goal pane). */
import { timeout } from './core.js';
export const CA = '3ibpM2bK8xMvAY2vYpQV6W3xWuxiPUoqPPJt4ieopump';
document.querySelectorAll('[data-copy-ca]').forEach(b => b.addEventListener('click', async e => {
  e.stopPropagation();
  try { await navigator.clipboard.writeText(CA); b.textContent = 'copied'; } catch { b.textContent = 'select it'; }
  setTimeout(() => (b.textContent = 'copy'), 1400);
}));
const usd = v => v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + Math.round(v);
async function refresh() {
  try {
    const r = await timeout(fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA), 8000); if (!r.ok) return;
    const d = await r.json(); const p = (d.pairs || []).sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0))[0]; if (!p) return;
    const mc = p.marketCap || p.fdv; const ch = p.priceChange && p.priceChange.h1;
    document.querySelectorAll('[data-coin=mcap]').forEach(e => (e.textContent = mc ? usd(mc) : '—'));
    document.querySelectorAll('[data-coin=chg]').forEach(e => { if (ch == null) return; e.textContent = (ch >= 0 ? '+' : '') + (+ch).toFixed(1) + '% 1h'; e.className = ch >= 0 ? 'up' : 'dn'; });
  } catch { }
}
refresh(); setInterval(refresh, 30000);
