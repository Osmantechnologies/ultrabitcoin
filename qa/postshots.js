// qa/postshots.js — 1600x900 post images of page regions (GPU headless). node qa/postshots.js
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const SHOTS = [['post-1-hero', '.hero-card'], ['post-2-hall', '#hall .hall'], ['post-3-wallets', '#wallets'], ['post-4-source', '#source']];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in')));
  await page.waitForTimeout(25000);   // let the agents land shares and the wallet cards fill
  for (const [name, sel] of SHOTS) {
    const el = await page.$(sel); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
    const b = await el.boundingBox(); const y = b.y + b.height / 2 - 450;
    await page.evaluate(y => window.scrollBy(0, y), y); await page.waitForTimeout(1500);
    await page.screenshot({ path: `qa/${name}.png` });
  }
  await browser.close();
})();
