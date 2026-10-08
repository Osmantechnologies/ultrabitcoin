// qa/connect-e2e.js — the wallet connector against MOCK Bitcoin wallets (no real extension, no keys, nothing signed for real).
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../world-of-hoodcraft/node_modules/playwright'));
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MOCKS = () => {
  const ICON = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#111"/><rect x="3" y="3" width="4" height="4" fill="#fa0"/></svg>');
  window.__calls = [];
  window.unisat = { requestAccounts: async () => (__calls.push('unisat'), ['bc1qsvg7z6re84xzcqequdp9jf23e0p90edmnrt5ln']), getAccounts: async () => ['bc1qsvg7z6re84xzcqequdp9jf23e0p90edmnrt5ln'], signMessage: async m => 'MOCKSIG', on() { } };
  window.XverseProviders = { BitcoinProvider: { request: async (m) => (__calls.push('xverse:' + m), { result: [{ address: 'bc1qys7t9afhypzs6vac2pyfp6mydr4uutqszjz63t', purpose: 'payment' }, { address: 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297', purpose: 'ordinals' }] }) } };
  window.LeatherProvider = { request: async () => { throw { code: 4001, message: 'User rejected the request' }; } };
  window.mockME = { bitcoin: { request: async () => ({ result: [{ address: 'bc1qe9pd5s47rq8ls8ee8h80gwnr8595vx4kgtenjs', purpose: 'payment' }] }) } };
  window.btc_providers = [{ id: 'XverseProviders.BitcoinProvider', name: 'Xverse Wallet', icon: ICON }, { id: 'mockME.bitcoin', name: 'Magic Eden', icon: ICON, webUrl: 'https://wallet.magiceden.io' }];
};
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--use-angle=d3d11', '--enable-gpu'] });
  const out = {};
  // ── desktop with mock wallets
  let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(MOCKS);
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now()); await page.waitForTimeout(5000);
  await page.click('#connectChip'); await page.waitForTimeout(500);
  out.list = await page.$$eval('.cx__w', b => b.map(x => x.innerText.replace(/\n/g, ' ')));
  await page.screenshot({ path: 'qa/cx-1-list.png' });
  await page.click('.cx__w[data-w=xverse]'); await page.waitForTimeout(600);
  out.pick = await page.$$eval('.cx__a', b => b.map(x => x.innerText.replace(/\n/g, ' ')));
  await page.screenshot({ path: 'qa/cx-2-pick.png' });
  await page.click('.cx__a[data-i="1"]'); await page.click('[data-use]'); await page.waitForTimeout(2500);
  out.afterXverse = await page.evaluate(() => ({ cur: JSON.parse(localStorage.getItem('ubtc.wallet')), chip: document.querySelector('#connectChip').innerText.replace(/\n/g, ' ') }));
  await page.evaluate(() => scrollTo(0, 0)); await page.click('#connectChip'); await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/cx-3-menu.png' });
  out.menu = await page.$eval('.cxm', m => m.innerText.replace(/\n/g, ' | '));
  await page.click('.cxm [data-m=switch]'); await page.waitForTimeout(400);
  await page.click('.cx__w[data-w=leather]'); await page.waitForTimeout(600);
  out.leatherError = await page.$eval('.cx__busy h3', h => h.innerText);
  await page.screenshot({ path: 'qa/cx-4-error.png' });
  await page.click('[data-back]'); await page.click('.cx__w[data-w=unisat]'); await page.waitForTimeout(1500);
  out.afterUnisat = await page.evaluate(() => JSON.parse(localStorage.getItem('ubtc.wallet')));
  out.vaultPane = await page.$eval('#fxWallet', e => e.innerText.slice(0, 260).replace(/\n/g, ' | '));
  await page.click('#connectChip'); await page.waitForTimeout(300); await page.click('.cxm [data-m=switch]'); await page.waitForTimeout(300);
  await page.click('.cx__w[data-w="sc:mockME.bitcoin"]'); await page.waitForTimeout(1200);
  out.afterMagicEden = await page.evaluate(() => JSON.parse(localStorage.getItem('ubtc.wallet')));
  await page.click('#connectChip'); await page.waitForTimeout(300); await page.click('.cxm [data-m=out]'); await page.waitForTimeout(500);
  out.afterDisconnect = await page.evaluate(() => ({ cur: localStorage.getItem('ubtc.wallet'), chip: document.querySelector('#connectChip').innerText }));
  out.errs = errs; await page.close();
  // ── phone, no wallets
  page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:5436/?v=' + Date.now()); await page.waitForTimeout(4000);
  await page.click('#connectChip'); await page.waitForTimeout(500);
  out.phoneNote = await page.$eval('.cx__note', n => n.innerText).catch(() => 'NO NOTE');
  await page.screenshot({ path: 'qa/cx-5-phone.png' });
  await page.fill('#cxAddr', 'bc1qlyfm68flzl6jfnht78ecnmj0p0wxdadgqh63yc'); await page.click('.cx__paste button'); await page.waitForTimeout(800);
  out.phonePaste = await page.evaluate(() => JSON.parse(localStorage.getItem('ubtc.wallet')));
  await page.screenshot({ path: 'qa/cx-6-phone-connected.png' });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
