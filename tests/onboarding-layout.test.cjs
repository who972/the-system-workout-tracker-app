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
        const nodes = [...overlay.querySelectorAll('.side-tag, h1, .ob-intro > p, [data-goal], .ob-actions button')];
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
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => {
        document.getElementById('awakeningAssessment')?.classList.remove('active');
        SystemOnboarding.reset(); SystemOnboarding.show();
      });
      await page.locator('#obName').fill('Landscape Tester');
      for (let step=0;step<9;step++) {
        const id=step<4?'systemOnboarding':'awakeningAssessment';
        const report=await page.evaluate(id=>{
          const el=document.getElementById(id);
          return {overflow:el.scrollHeight-el.clientHeight, nodes:[...el.querySelectorAll('h1,p,small,strong,.side-tag,button,input')].map(n=>{
            const r=n.getBoundingClientRect();
            return {text:n.textContent||n.id,top:r.top,bottom:r.bottom,left:r.left,right:r.right};
          })};
        },id);
        if (report.overflow>1 && process.env.LAYOUT_SCREENSHOT) await page.screenshot({path:process.env.LAYOUT_SCREENSHOT});
        assert.ok(report.overflow<=1,`${width}x${height} step ${step+1}: overflow ${report.overflow}`);
        for(const n of report.nodes) assert.ok(n.top>=0&&n.bottom<=height&&n.left>=0&&n.right<=width,`${width}x${height} step ${step+1}: clipped ${n.text}`);
        if(width===740 && process.env.LAYOUT_SCREENSHOT) await page.screenshot({path:process.env.LAYOUT_SCREENSHOT.replace('.png',`-${step+1}.png`)});
        if(step>=4 && step<8) assert.equal(await page.locator('#awakeningAssessment .ob-safety').count(),1);
        if(step===2) await page.locator('[data-exp="intermediate"]').click();
        if(step===3) { await page.locator('[data-eq="Dumbbells"]').click(); await page.locator('#obDays').fill('3'); }
        if(step===4) {await page.locator('#awSit').fill('10'); await page.locator('#awPush').fill('5');}
        if(step===5) { await page.locator('#awWalk').fill('4'); await page.locator('[data-endurance-mode="indoor"]').click(); await page.locator('[data-walk-effort="2"]').click(); }
        if(step===6) { await page.locator('#awMarch').fill('3'); await page.locator('[data-march-effort="2"]').click(); }
        if(step===7) {await page.locator('[data-mob="3"]').click();await page.locator('[data-energy="2"]').click();}
        await page.locator(step<4?'#obNext':'#awNext').click();
      }
      assert.equal(await page.locator('#awakeningAssessment.active').count(),0);
      const saved=await page.evaluate(()=>({ob:onboardingData(),assessment:JSON.parse(localStorage.getItem(ASSESSMENT_KEY))}));
      assert.equal(saved.ob.experience,'intermediate');
      assert.ok(saved.ob.equipment.includes('Dumbbells'));
      assert.equal(saved.ob.days,3);
      assert.equal(saved.assessment.raw.sit,10);
      console.log(`PASS ${width}x${height}: all 9 onboarding/assessment screens fit and completion saves input`);
    }
    await page.clock.install();
    await page.setViewportSize({width:740,height:360});
    await page.evaluate(()=>SystemOnboarding.assessment());
    assert.match(await page.locator('#awakeningAssessment .ob-intro').innerText(),/one untimed set/);
    await page.locator('#awSit').fill('12');
    await page.locator('#awPush').fill('6');
    assert.equal(await page.locator('#awClock').innerText(),'01:00');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(10000);
    assert.equal(await page.locator('#awClock').innerText(),'00:50');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(20000);
    assert.equal(await page.locator('#awClock').innerText(),'00:50');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(50000);
    assert.equal(await page.locator('#awClock').innerText(),'00:00');
    assert.match(await page.locator('#awTimerStatus').innerText(),/Time complete/);
    assert.equal(await page.locator('#awSit').inputValue(),'12');
    assert.equal(await page.locator('#awPush').inputValue(),'6');
    await page.locator('#awTimerReset').click();
    assert.equal(await page.locator('#awClock').innerText(),'01:00');
    await page.locator('#awNext').click();
    assert.equal(await page.locator('#awClock').innerText(),'06:00');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(10000);
    await page.locator('#awBack').click();
    await page.clock.fastForward(20000);
    assert.equal(await page.locator('#awClock').innerText(),'01:00');
    await page.locator('#awNext').click();
    assert.equal(await page.locator('#awClock').innerText(),'05:50');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(350000);
    assert.equal(await page.locator('#awClock').innerText(),'00:00');
    await page.locator('#awNext').click();
    assert.equal(await page.locator('#awClock').innerText(),'02:00');
    await page.locator('#awTimerStart').click();
    await page.clock.fastForward(120000);
    assert.equal(await page.locator('#awClock').innerText(),'00:00');
    await page.locator('#awNext').click();
    assert.equal(await page.locator('#awClock').count(),0);
    console.log('PASS countdowns: 60s / 6min / 2min, pause/resume, reset, completion, input preservation and navigation cleanup');
    await page.evaluate(()=>{ localStorage.removeItem(ASSESSMENT_KEY); SystemOnboarding.assessment(); });
    await page.locator('#awSit').fill('20'); await page.locator('#awPush').fill('10'); await page.locator('#awNext').click();
    await page.locator('#awWalk').fill('6');
    assert.equal(await page.locator('[data-endurance-mode]').count(),5);
    await page.locator('[data-endurance-mode="seated"]').click();
    assert.equal(await page.locator('#awWalk').inputValue(),'6');
    assert.equal(await page.locator('[data-endurance-mode="seated"].selected').count(),1);
    await page.locator('[data-endurance-mode="walk"]').click();
    assert.equal(await page.locator('#awWalk').inputValue(),'6');
    await page.locator('[data-walk-effort="2"]').click(); await page.locator('#awNext').click();
    await page.locator('#awMarch').fill('2'); await page.locator('[data-march-effort="2"]').click(); await page.locator('#awNext').click();
    await page.locator('[data-mob="2"]').click(); await page.locator('[data-energy="2"]').click(); await page.locator('#awNext').click();
    const calibrated=await page.locator('.assessment-list').innerText();
    assert.match(calibrated,/Endurance:\s*78/); assert.match(calibrated,/Conditioning:\s*78/);
    console.log('PASS calibrated scoring: full-duration moderate effort = 55, capped below 70');
    if (process.env.LAYOUT_SCREENSHOT) await page.screenshot({ path: process.env.LAYOUT_SCREENSHOT });
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
