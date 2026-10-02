const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(root,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':data)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.SystemOS&&window.SystemOnboarding);
  // Isolate the window manager from delayed authentication/boot overlays.
  await page.addStyleTag({content:'#systemBoot,#authGate,#systemEntryScreen{display:none!important}'});
  await page.evaluate(()=>{document.querySelectorAll('.auth-gate,.system-entry-screen,.system-boot').forEach(e=>e.hidden=true);document.querySelectorAll('.system-onboarding').forEach(e=>e.classList.remove('active'));document.body.classList.remove('system-entry-open','system-boot-open')});
  const modules=['player','missions','side','boss','telemetry','progress','achievements','profile','nutrition','exercise','social'];
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500]]){
   await page.setViewportSize({width,height});
   for(const name of modules){
    await page.evaluate(name=>SystemOS.open(name),name);
    const stage=page.locator('.os-module-stage');
    await stage.evaluate(async e=>await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
    const report=await stage.evaluate(e=>{
     const r=e.getBoundingClientRect(),body=e.querySelector('.os-module-body'),close=e.querySelector('#osModuleClose').getBoundingClientRect();
     return {x:r.x,y:r.y,w:r.width,h:r.height,close:{x:close.x,y:close.y,right:close.right,bottom:close.bottom},overflow:body.scrollWidth-body.clientWidth,animation:getComputedStyle(e).animationName,module:e.dataset.module};
    });
    assert.equal(report.module,name);
    assert(Math.abs(report.x+report.w/2-width/2)<2&&Math.abs(report.y+report.h/2-height/2)<2,`${name}: centered`);
    assert(report.x>=0&&report.y>=0&&report.w>=width*.8&&report.h>=height*.8,`${name}: uses viewport`);
    assert(report.close.x>=0&&report.close.y>=0&&report.close.right<=width&&report.close.bottom<=height,`${name}: exit visible`);
    if(report.overflow>2)console.log(await stage.evaluate(e=>{const body=e.querySelector('.os-module-body'),r=body.getBoundingClientRect();return [...body.querySelectorAll('*')].map(x=>({tag:x.tagName,id:x.id,cls:x.className,w:x.getBoundingClientRect().width,right:x.getBoundingClientRect().right,min:getComputedStyle(x).minWidth})).filter(x=>x.right>r.right+2).slice(0,16)}));
    assert(report.overflow<=2,`${name}: horizontal overflow ${report.overflow}`);
    assert.equal(report.animation,'systemWindowProject');
    if(name==='telemetry') {
     assert.equal(await stage.locator('#systemHealthTelemetryPanel .health-metric-card').count(),8);
     assert.equal(await stage.locator('#exerciseForm').count(),0);
     const clipped=await stage.locator('#systemHealthTelemetryPanel').evaluate(e=>[e,...e.querySelectorAll('p,strong,small,button,.health-metric-card')].filter(n=>{const r=n.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1}).map(n=>n.textContent));
     assert.deepEqual(clipped,[],`${width}x${height}: HEALTH content fits without scrolling`);
     if(width===915&&process.env.HEALTH_SCREENSHOT)await page.screenshot({path:process.env.HEALTH_SCREENSHOT});
    }
    if(name==='exercise')assert.equal(await stage.locator('#exerciseForm').count(),1);
    await page.locator('#osModuleClose').click();
    assert.equal(await stage.isVisible(),false);
   }
   console.log(`PASS ${width}x${height}: all 11 module windows center, fill the viewport, animate and close`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>SystemOS.open('telemetry'));
  assert.equal(await page.locator('.os-module-stage').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('#osModuleClose').click();
  console.log('PASS: reduced-motion preference disables window animation');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1024,height:500});
  await page.evaluate(()=>{SystemOnboarding.assessment();for(let i=0;i<4;i++)document.getElementById('awNext').click()});
  const summary=await page.locator('#awakeningAssessment .classification-dashboard').boundingBox();
  const card=await page.locator('#awakeningAssessment .ob-card').boundingBox();
  assert(summary.height>card.height*.55,'Classification should use the available middle area');
  assert.equal(await page.locator('.assessment-list p').count(),6);
  await page.locator('#awakeningAssessment').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})))});
  if(process.env.WINDOW_SCREENSHOT)await page.screenshot({path:process.env.WINDOW_SCREENSHOT});
  console.log('PASS: classification uses expanded rank/stat/path cards');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
