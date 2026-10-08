// qa/wallshots.js — the video wall: room view, then tap-to-read on three panels. node qa/wallshots.js [WxH]
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const [W, H] = (process.argv[2] || '1280x800').split('x').map(Number);
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(14000);
  const st = await page.$('#stage'); await st.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
  await page.screenshot({ path: `qa/wall-room-${W}.png` });
  // screen point of a world point on the wall
  const at = async (x, y) => page.evaluate(([x, y]) => { const D = window.__DECK; const v = new D.camera.position.constructor(x, y, -11.47).project(D.camera); const r = document.getElementById('stage').getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [x, y]);
  for (const [name, x, y] of [['machine', -4.1, 4.5], ['hist', 4.1, 4.5], ['top', -2, 9.2]]) {
    const [px, py] = await at(x, y); await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(3200); await page.screenshot({ path: `qa/wall-${name}-${W}.png` });
    await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(2500);   // fly back
  }
  console.log(JSON.stringify({ errs }));
  await browser.close();
})();
