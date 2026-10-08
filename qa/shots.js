// qa/shots.js — GPU headless screenshots (Playwright + headless shell with d3d11), the openhuman-live recipe.
// node qa/shots.js <W>x<H> <out-prefix> <scrollY,...>
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = process.env.CHROME_EXE || path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const [W, H] = process.argv[2].split('x').map(Number); const pre = process.argv[3]; const ys = (process.argv[4] || '0').split(',').map(Number);
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  for (const y of ys) {
    await page.evaluate(y => { document.querySelectorAll('.rv').forEach(e => e.classList.add('in')); window.scrollTo(0, y); }, y);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${pre}-${y}.png` });
  }
  const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, fps: (document.querySelector('#fps') || {}).textContent, h: document.documentElement.scrollHeight }));
  console.log(JSON.stringify({ info, errs }));
  await browser.close();
})();
