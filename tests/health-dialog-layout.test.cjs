// Real app DOM/CSS, native dialog, and mocked Health Connect transport.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  const html=fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('**/*',r=>r.abort());
   await page.setContent(html);
   await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
   await page.addStyleTag({content:fs.readFileSync('window-layout.css','utf8')});
   await page.evaluate(()=>{
    document.body.classList.add('system-os-ready');
    window.AndroidHealthConnect={getStatus:async()=>({availability:'available',connected:false,permissions:[]}),requestPermissions:async()=>({granted:false}),readHealthData:async()=>({})};
   });
   await page.addScriptTag({content:fs.readFileSync('health-connect.js','utf8')});
   assert.equal(await page.locator('.hud-wing--left #openHealthConnect').count(),0);
   assert.equal(await page.locator('#hudHealthTelemetry #openHealthConnect').count(),1);
   await page.evaluate(()=>document.getElementById('openHealthConnect').click());
   const modal=page.locator('#systemHealthConnectDialog');
   await modal.waitFor({state:'visible'});
   assert.equal(await modal.evaluate(e=>e.matches(':modal')),true);
   const box=await modal.boundingBox();
   assert(box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${width}x${height}`);
   assert.match(await modal.locator('[data-status]').textContent(),/Disconnected/);
   assert.equal(await modal.locator('.health-metric-card').count(),8);
   for(const scenario of ['values','empty','errors']) {
    await page.evaluate(scenario=>{
     window.AndroidHealthConnect.getStatus=async()=>({availability:'available',connected:true,permissions:['all']});
     window.AndroidHealthConnect.readHealthData=async()=>scenario==='values'?{steps:0,activeCalories:0,totalCalories:1250,distanceMeters:0,heartRate:{average:65},exerciseSessions:[{start:'2026-10-01T00:00:00Z',end:'2026-10-01T00:10:00Z',source:'Samsung Health'}],sleepSessions:[],syncedAt:new Date().toISOString()}:scenario==='empty'?{steps:null,exerciseSessions:[],sleepSessions:[]}: {errors:{steps:'permission-required',activeCalories:'health-read-failed',totalCalories:'permission-required',distanceMeters:'health-read-failed',heartRate:'permission-required',exerciseSessions:'health-read-failed',sleepSessions:'permission-required',activeMinutes:'permission-required'}};
    },scenario);
    await modal.locator('[data-refresh]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-refresh]').disabled);
    assert.equal(await modal.locator('.health-metric-card').count(),8);
    if(scenario==='values')assert.match(await modal.locator('[data-metric="steps"]').textContent(),/0 steps/);
    if(scenario==='empty')assert.equal(await modal.locator('[data-state="no-records"]').count(),8);
    if(scenario==='errors'){assert.equal(await modal.locator('[data-state="permission-needed"]').count(),5);assert.equal(await modal.locator('[data-state="read-failed"]').count(),3)}
    const bad=await modal.evaluate(e=>{
     const nodes=[e,e.querySelector('.health-connect-window-body'),...e.querySelectorAll('button,.health-metric-card,strong,p,small')];
     return nodes.filter(n=>{const r=n.getBoundingClientRect();return r.top<0||r.left<0||r.bottom>innerHeight+1||r.right>innerWidth+1||n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1}).map(n=>n.textContent);
    });
    assert.deepEqual(bad,[],`${width}x${height} ${scenario}: no overflow`);
   }
   const exit=await modal.locator('[data-exit]').boundingBox();
   assert(exit&&exit.y>=0&&exit.y+exit.height<=height,'Exit must remain visible after scrolling');
   await modal.locator('[data-connect]').click();
   await modal.locator('[data-exit]').click();
   assert.equal(await modal.isVisible(),false);
   assert.equal(await modal.evaluate(e=>e.matches(':modal')),false);
   // HEALTH tab's legacy button must route to the same working dialog.
   await page.evaluate(()=>{
    const button=document.createElement('button');button.id='healthConnectAction';
    button.onclick=()=>window.legacyClicked=true;document.body.append(button);button.click();
   });
   await modal.waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>window.legacyClicked),undefined);
   await modal.locator('[data-exit]').click();
   await page.close();
  }
  console.log('PASS: Health dialog visible with real OS CSS, centered at ten landscape sizes with permission, empty, error and zero states, closes cleanly, and opens from the HEALTH tab');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

