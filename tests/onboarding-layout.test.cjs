// Run with Playwright available on NODE_PATH. Optional CHROMIUM_PATH selects a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  fs.readFile(file, (error, bytes) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? '' : bytes);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 740, height: 360 }, serviceWorkers: 'block' });
    // No real account or cloud calls: exercise the actual onboarding renderer locally.
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      getCloudSession = () => ({ access_token: 'layout-test-only' });
      SystemOnboarding.reset();
      SystemOnboarding.show();
    });
    await page.locator('#obNext').click();
    const sizes = [[568, 240], [568, 256], [640, 320], [667, 375], [740, 360], [812, 375], [844, 390], [915, 412], [960, 432], [1024, 500]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      const result = await page.evaluate(() => {
        const overlay = document.getElementById('systemOnboarding');
        const options = overlay.querySelector('.ob-options');
        const nodes = [...overlay.querySelectorAll('.side-tag, h1, .ob-card > p, [data-goal], .ob-actions button')];
        return {
          count: overlay.querySelectorAll('[data-goal]').length,
          columns: getComputedStyle(options).gridTemplateColumns.split(' ').length,
          overflow: overlay.scrollHeight - overlay.clientHeight,
          bounds: nodes.map(node => {
            const r = node.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            const range = document.createRange(); range.selectNodeContents(node);
            const text = range.getBoundingClientRect();
            return { label: node.textContent, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
              textFits: text.top >= 0 && text.bottom <= innerHeight && text.left >= 0 && text.right <= innerWidth,
              reachable: hit === node || node.contains(hit) };
          })
        };
      });
      assert.equal(result.count, 5);
      assert.equal(result.columns, 2);
      assert.ok(result.overflow <= 1, `${width}x${height}: scroll overflow ${result.overflow}`);
      for (const b of result.bounds) {
        assert.ok(b.top >= 0 && b.bottom <= height && b.left >= 0 && b.right <= width, `${width}x${height}: clipped ${b.label}`);
        assert.ok(b.textFits && b.reachable, `${width}x${height}: hidden text or obstructed control ${b.label}`);
      }
      for (const goal of ['fat-loss', 'muscle', 'strength', 'endurance', 'balanced']) {
        await page.locator(`[data-goal="${goal}"]`).click();
        assert.equal(await page.locator(`[data-goal="${goal}"].selected`).count(), 1);
      }
      await page.locator('#obNext').click();
      assert.equal(await page.locator('#systemOnboarding.ob-path-screen').count(), 0);
      await page.locator('#obBack').click();
      assert.equal(await page.locator('[data-goal="balanced"].selected').count(), 1);
      console.log(`PASS ${width}x${height}: all goals, text and navigation fit; selection and Next/Back work`);
    }
    if (process.env.LAYOUT_SCREENSHOT) await page.screenshot({ path: process.env.LAYOUT_SCREENSHOT });
    await page.locator('#obBack').click();
    assert.equal(await page.locator('#obName').count(), 1);
    assert.equal(await page.locator('#systemOnboarding.ob-path-screen').count(), 0);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
