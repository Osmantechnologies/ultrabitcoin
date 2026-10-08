// qa/post2shots.js — images for social/SECOND-POST.md (1600x900): wall top band, SHA-256 machine, zero-bit histogram, the lock pane.
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(30000);   // let the wall fill: samples, histogram, a few shares
  const st = await page.$('#stage'); await st.scrollIntoViewIfNeeded();
  await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); window.scrollBy(0, r.top - 40); }); await page.waitForTimeout(800);
  const at = (x, y) => page.evaluate(([x, y]) => { const D = window.__DECK; const v = new D.camera.position.constructor(x, y, -11.47).project(D.camera); const r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [x, y]);
  const box = await st.boundingBox();
  for (const [name, x, y, wait] of [['post2-1-top', 0, 9.2, 3500], ['post2-2-machine', -4.1, 4.5, 6200], ['post2-3-zerobits', 4.1, 4.5, 3500]]) {
    const [px, py] = await at(x, y); await page.mouse.click(px, py); await page.waitForTimeout(wait);
    await page.screenshot({ path: `qa/${name}.png`, clip: { x: box.x, y: Math.max(0, box.y), width: box.width, height: Math.min(900 - Math.max(0, box.y), box.height) } });
    await page.mouse.click(px, py); await page.waitForTimeout(2600);
  }
  const g = await page.$('#goal'); await g.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
  await g.screenshot({ path: 'qa/post2-4-lock.png' });
  await browser.close();
})();
