// qa/post2web.js — 16:9 screenshots of the LIVE site for the second post (2x for crispness).
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('https://ultrabitcoinfaucet.tech/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(32000);
  // 1) the hall: tiles + ticker + the whole wall
  await page.evaluate(() => { const k = document.getElementById('kpis').getBoundingClientRect(); window.scrollBy(0, k.top - 44); }); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/post2-web-hall.png' });
  // 2) the lock: goal + creator fees + wallets
  await page.evaluate(() => { const g = document.getElementById('goal').getBoundingClientRect(); window.scrollBy(0, g.top - 44); }); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/post2-web-lock.png' });
  await browser.close();
})();
