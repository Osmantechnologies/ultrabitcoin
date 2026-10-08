/* github.js — the sources, live: Anthropic's eval file (raw.githubusercontent, CORS *) + its repo and commits (GitHub API),
   and this faucet's own repo. data/snapshot.json renders first so the panes are never empty; live data replaces it.
   Same drill as openhuman-live: 6 s timeout, 10-minute localStorage cache. */
import { timeout } from './core.js';

export const EVAL = { repo: 'anthropics/evals', path: 'advanced-ai-risk/lm_generated_evals/one-box-tendency.jsonl', line: 723 };
export const OURS = 'Osmantechnologies/ultrabitcoin';
const RAW = `https://raw.githubusercontent.com/${EVAL.repo}/main/${EVAL.path}`;
const API = 'https://api.github.com/repos/';
const TTL = 10 * 60 * 1000;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = iso => iso ? iso.slice(0, 10) : '—';
const agoIso = iso => { const s = (Date.now() - new Date(iso)) / 1000; return s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
const kb = b => b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : Math.round(b / 1e3) + ' KB';
async function cached(key, fn) {
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < TTL) return c.v; } catch { }
  const v = await fn(); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch { } return v;
}
const getJSON = url => timeout(fetch(url, { headers: { Accept: 'application/vnd.github+json' } }), 6000).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });

/* ───────── fetchers ───────── */
async function evalRepo() {
  return cached('ubtc.gh.eval', async () => {
    const [r, c] = await Promise.all([getJSON(API + EVAL.repo), getJSON(`${API}${EVAL.repo}/commits?path=${encodeURIComponent(EVAL.path)}&per_page=5`)]);
    return { repo: { full_name: r.full_name, stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at, created_at: r.created_at, default_branch: r.default_branch, html_url: r.html_url, license: (r.license || {}).spdx_id },
      commits: c.map(x => ({ sha: x.sha, date: x.commit.author.date, msg: x.commit.message.split('\n')[0], url: x.html_url })) };
  });
}
// the whole file (~1 MB, 1,000 questions), read live: the excerpt around line 723 and a live grep for "ultrabitcoin"
async function evalFile() {
  const r = await timeout(fetch(RAW), 15000); if (!r.ok) throw new Error(r.status);
  const text = await r.text(); const lines = text.split('\n'); if (lines[lines.length - 1] === '') lines.pop();
  const excerpt = {}; for (let i = EVAL.line - 5; i <= EVAL.line + 3; i++) if (lines[i]) excerpt[i + 1] = i + 1 === EVAL.line ? lines[i] : lines[i].slice(0, 240);
  return { bytes: new Blob([text]).size, lines: lines.length, matches: lines.map((l, i) => (/ultrabitcoin/i.test(l) ? i + 1 : 0)).filter(Boolean), excerpt };
}
async function ourRepo() {
  return cached('ubtc.gh.ours', async () => {
    const [r, c, t] = await Promise.all([getJSON(API + OURS), getJSON(`${API}${OURS}/commits?per_page=12`), getJSON(`${API}${OURS}/contents/`).catch(() => [])]);
    return { repo: { full_name: r.full_name, stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at, html_url: r.html_url, size: r.size, language: r.language },
      commits: c.map(x => ({ sha: x.sha, date: x.commit.author.date, msg: x.commit.message.split('\n')[0], url: x.html_url })),
      tree: t.map(f => ({ name: f.name, type: f.type, url: f.html_url })) };
  });
}

/* ───────── render ───────── */
const hl = s => esc(s).replace(/ultrabitcoins?/gi, m => `<mark>${m}</mark>`);
function lineView(file, full) {
  const rows = Object.entries(file.excerpt).map(([n, l]) => {
    const on = +n === EVAL.line;
    return `<div class="src__l ${on ? 'on' : ''}"><span class="n">${n}</span><span class="c">${on && full ? hl(l) : esc(l.slice(0, 160))}</span></div>`;
  }).join('');
  return `<div class="src">${rows}</div>`;
}
function question(file) {
  const raw = file.excerpt[EVAL.line]; if (!raw) return '';
  let q; try { q = JSON.parse(raw); } catch { return ''; }
  return `<dl class="rules rules--w src__q">
    <dt>question</dt><dd>${hl(q.question)}</dd>
    <dt>matching</dt><dd><b>${esc(q.answer_matching_behavior.trim())}</b> <span class="dim">one-box: take only the sealed container</span></dd>
    <dt>not matching</dt><dd>${esc(q.answer_not_matching_behavior.trim())} <span class="dim">two-box</span></dd></dl>`;
}
function evalStats(e, file, live) {
  const R = e.repo, c = e.commits[0] || {};
  return `<dl class="rules rules--w">
    <dt>repo</dt><dd><a class="u" href="${R.html_url}" target="_blank" rel="noopener">${R.full_name}</a> · ${(R.stargazers_count || 0).toLocaleString('en-US')} stars · ${R.forks_count} forks · ${R.license || '—'}</dd>
    <dt>file</dt><dd><a class="u" href="https://github.com/${EVAL.repo}/blob/main/${EVAL.path}#L${EVAL.line}" target="_blank" rel="noopener">${EVAL.path}</a></dd>
    <dt>size</dt><dd>${kb(file.bytes)} · ${file.lines.toLocaleString('en-US')} questions, one json object per line</dd>
    <dt>grep</dt><dd><span class="z">"ultrabitcoin"</span> → ${file.matches.length} line${file.matches.length === 1 ? '' : 's'}: ${file.matches.map(m => '#' + m).join(', ') || '—'} <span class="dim">${live ? '(read live just now)' : '(snapshot)'}</span></dd>
    <dt>last commit</dt><dd><a class="u" href="${c.url || '#'}" target="_blank" rel="noopener">${(c.sha || '').slice(0, 7)}</a> ${esc(c.msg || '')} · ${day(c.date)}</dd>
  </dl>`;
}
function ourView(o) {
  if (!o) return `<div class="pane__body dim">github.com/${OURS} · reading…</div>`;
  const R = o.repo;
  return `<dl class="rules rules--w" style="padding:12px 14px 6px">
      <dt>repo</dt><dd><a class="u" href="${R.html_url}" target="_blank" rel="noopener">${R.full_name}</a> · ${R.stargazers_count} stars · ${R.language || 'JavaScript'}</dd>
      <dt>last push</dt><dd>${day(R.pushed_at)} · ${agoIso(R.pushed_at)} ago</dd>
      ${o.tree && o.tree.length ? `<dt>tree</dt><dd>${o.tree.map(f => `<a class="u" href="${f.url}" target="_blank" rel="noopener">${esc(f.name)}${f.type === 'dir' ? '/' : ''}</a>`).join(' ')}</dd>` : ''}
    </dl>
    <ul class="log gitlog">${o.commits.map(c => `<li><span class="t">${c.date.slice(5, 10)}</span><a class="who" href="${c.url}" target="_blank" rel="noopener">${c.sha.slice(0, 7)}</a><span class="msg">${esc(c.msg)}</span></li>`).join('')}</ul>`;
}

export async function initSources() {
  const $ = s => document.querySelector(s);
  let snap = null; try { snap = await (await fetch('data/snapshot.json', { cache: 'no-store' })).json(); } catch { }
  const state = { eval: snap && snap.eval, file: snap && snap.eval && snap.eval.file, fileLive: false, ours: snap && snap.ours, ourLive: false };
  function paint() {
    const f = state.file, e = state.eval;
    if (f && e) {
      $('#srcLines') && ($('#srcLines').innerHTML = lineView(f, true) + question(f));
      $('#srcStats') && ($('#srcStats').innerHTML = evalStats(e, f, state.fileLive));
      $('#srcMini') && ($('#srcMini').innerHTML = lineView(f, true));
      document.querySelectorAll('[data-src-status]').forEach(el => (el.textContent = state.fileLive ? '● live · raw.githubusercontent' : '○ snapshot ' + (snap ? snap.fetched_at.slice(0, 10) : '')));
    }
    $('#srcOurs') && ($('#srcOurs').innerHTML = ourView(state.ours));
    document.querySelectorAll('[data-our-status]').forEach(el => (el.textContent = state.ourLive ? '● live · api.github.com' : state.ours ? '○ snapshot' : '○ reading'));
  }
  paint();
  evalRepo().then(v => { state.eval = { ...v, file: state.file }; paint(); }).catch(() => { });
  ourRepo().then(v => { state.ours = v; state.ourLive = true; paint(); }).catch(() => paint());
  // the 1 MB file loads after the page settles, so it never competes with the deck
  setTimeout(() => evalFile().then(f => { state.file = f; state.fileLive = true; paint(); }).catch(() => { }), 3500);
  setInterval(() => ourRepo().then(v => { state.ours = v; state.ourLive = true; paint(); }).catch(() => { }), TTL);
}
