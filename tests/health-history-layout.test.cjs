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
  const page=await browser.newPage({serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.addInitScript(()=>{
   const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   window.__healthHistoryCalls=[];window.__healthAccess=true;
   window.AndroidHealthConnect={getStatus:async()=>({availability:'available',connected:true,permissions:window.__healthAccess?['all']:[]}),
    readHealthData:async()=>({date:day(new Date()),steps:4321,activeMinutes:20}),
    readHealthHistory:async days=>{
     window.__healthHistoryCalls.push(days);
     return {days,date:day(new Date()),syncedAt:new Date().toISOString(),errors:{},daily:Array.from({length:days},(_,index)=>{
      const d=new Date();d.setDate(d.getDate()-days+1+index);
      const steps=index===1?null:index===2?0:2000+index*120;
      return {date:day(d),steps,activeCalories:steps===null?null:steps/20,totalCalories:2100+index*10,distanceMeters:steps===null?null:steps*.7,heartRateAverage:67+index%5,activeMinutes:index%3===0?null:15+index,sleepMinutes:360+index%4*30};
     })};
    }
   };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.SystemHealthHistory&&window.SystemOS);
  await page.addStyleTag({content:'#systemBoot,#authGate,#systemEntryScreen{display:none!important}'});
  await page.evaluate(()=>{document.querySelectorAll('.system-onboarding').forEach(e=>e.classList.remove('active'));document.body.classList.remove('system-entry-open','system-boot-open')});
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>SystemOS.open('telemetry'));
   const panel=page.locator('#systemHealthTelemetryPanel');
   await page.locator('.os-module-stage').evaluate(async e=>await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
   for(const days of [7,14,30]){
    await panel.locator(`[data-health-days="${days}"]`).click();
    await page.waitForFunction(days=>document.querySelectorAll('[data-chart-date]').length===days&&!SystemHealthHistory.isBusy(),days);
    for(const metric of ['steps','activeCalories','totalCalories','distanceMeters','heartRateAverage','activeMinutes','sleepMinutes']){
     await panel.locator('select').selectOption(metric);
     const clipped=await panel.evaluate(e=>[e,...e.querySelectorAll('.health-history-toolbar,.health-history,aside,strong,span,small,button,select')].filter(n=>{
      if(n.closest('[hidden]')||getComputedStyle(n).display==='none'||n.classList.contains('health-history-sr'))return false;
      const r=n.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||r.left<0||r.top<0||n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2;
     }).map(n=>({cls:n.className,text:n.textContent.slice(0,80),w:n.clientWidth,sw:n.scrollWidth,h:n.clientHeight,sh:n.scrollHeight})));
     assert.deepEqual(clipped,[],`${width}x${height}/${days}/${metric}: history fits without scrolling`);
     assert.equal(await panel.locator('[data-chart-date]').count(),days);
    }
    await panel.locator('select').selectOption('steps');
    await panel.locator('[data-chart-date]').nth(2).click();assert.equal(await panel.locator('[data-history-value]').textContent(),'0 steps');
    await panel.locator('[data-chart-date]').nth(1).focus();await page.keyboard.press('Enter');assert.equal(await panel.locator('[data-history-value]').textContent(),'No records');
   }
   if(width===915&&process.env.HISTORY_SCREENSHOT)await page.screenshot({path:process.env.HISTORY_SCREENSHOT});
   await panel.locator('[data-health-days="0"]').click();assert.equal(await panel.locator('.health-metric-card').count(),8);
   await page.locator('#osModuleClose').click();assert.equal(await panel.locator('[data-history-chart]').textContent(),'');
   console.log(`PASS ${width}x${height}: 7/14/30-day history, seven metrics, zero/gaps, keyboard selection and Today`);
  }
  await page.evaluate(()=>SystemOS.open('telemetry'));await page.locator('[data-health-days="7"]').click();
  await page.waitForFunction(()=>!SystemHealthHistory.isBusy());
  await page.evaluate(()=>window.__healthAccess=false);await page.locator('[data-history-refresh]').click();await page.waitForFunction(()=>!SystemHealthHistory.isBusy());
  assert.match(await page.locator('[data-history-state]').textContent(),/Permission needed/);assert.equal(await page.locator('[data-chart-date]').count(),0);
  assert.deepEqual(errors,[],'No browser errors');console.log('PASS: revoked access removes the chart; no browser errors');
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
