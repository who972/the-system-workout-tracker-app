const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname,file=path.join(root,name==='/'?'index.html':name);
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':data)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  async function openPage(saved={}){
   const page=await browser.newPage({viewport:{width:915,height:412},serviceWorkers:'block'});
   await page.addInitScript(saved=>{for(const [k,v] of Object.entries(saved))localStorage.setItem(k,JSON.stringify(v))},saved);
   const session={access_token:'test-token',user:{id:'test-user',email:'test@example.com'}};
   await page.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='127.0.0.1')return r.continue();
    if(u.pathname==='/auth/v1/user')return r.fulfill({json:session.user});
    if(u.pathname==='/auth/v1/token')return r.fulfill({json:session});
    return r.abort();
   });
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.waitForFunction(()=>window.SystemOS&&window.SystemOnboarding);
   await page.waitForTimeout(650); // Beyond both former page-load startup timers.
   assert(await page.locator('#systemEntryScreen').isVisible());
   assert.equal(await page.locator('.system-onboarding.active').count(),0,'No setup/assessment before ENTER');
   assert(!(await page.locator('#systemBoot').isVisible()),'No briefing over entry');
   return page;
  }
  const session={access_token:'test-token',user:{id:'test-user',email:'test@example.com'}};
  let page=await openPage();
  await page.locator('#enterTheSystem').click();
  assert(await page.locator('#authGate').isVisible());
  assert.equal(await page.locator('.system-onboarding.active').count(),0,'No assessment while signing in');
  await page.locator('#authEmail').fill('test@example.com');await page.locator('#authPassword').fill('test-password');
  await page.locator('#authSubmit').click();await page.locator('#systemOnboarding.active').waitFor();
  assert(!(await page.locator('#systemEntryScreen').isVisible()));assert(!(await page.locator('#authGate').isVisible()));
  for(let i=0;i<4;i++)await page.locator('#obNext').click();
  await page.locator('#awakeningAssessment.active').waitFor();
  console.log('PASS: fresh sign-in enters setup, then assessment, after ENTER and authentication');await page.close();
  page=await openPage({theSystemCloudSession:session});await page.locator('#enterTheSystem').click();await page.locator('#systemOnboarding.active').waitFor();
  console.log('PASS: remembered new account waits for entry/authentication before setup');await page.close();
  page=await openPage({theSystemCloudSession:session,systemOnboardingV2:{assessmentPending:true,path:'Balanced'}});
  await page.locator('#enterTheSystem').click();await page.locator('#awakeningAssessment.active').waitFor();
  console.log('PASS: pending assessment resumes only after entry/authentication');await page.close();
  page=await openPage({theSystemCloudSession:session,systemOnboardingV2:{assessmentPending:false},systemAwakeningAssessmentV1:{rank:'E'}});
  await page.locator('#enterTheSystem').click();await page.locator('#systemEntryScreen').waitFor({state:'hidden'});
  assert.equal(await page.locator('.system-onboarding.active').count(),0,'Completed users do not repeat setup');
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>replayDailyBriefing());
   async function check(id){
    const result=await page.locator(id).evaluate(e=>{
     const box=e.getBoundingClientRect(),bad=[];
     for(const n of e.querySelectorAll('h1,p,strong,small,button,.system-boot__eyebrow')){
      const r=n.getBoundingClientRect();if(r.top<box.top||r.bottom>box.bottom||r.left<box.left||r.right>box.right)bad.push(n.textContent);
      if(n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1)bad.push('text overflow: '+n.textContent);
     }
     return {overflow:e.scrollHeight-e.clientHeight,horizontal:e.scrollWidth-e.clientWidth,bad,box:{top:box.top,bottom:box.bottom,left:box.left,right:box.right}};
    });
    assert(result.overflow<=1&&result.horizontal<=1,`${id} ${width}x${height}: ${JSON.stringify(result)}`);
    assert.deepEqual(result.bad,[],`${id} ${width}x${height}`);
    assert(result.box.top>=-1&&result.box.bottom<=height+1&&result.box.left>=-1&&result.box.right<=width+1,`${id} ${width}x${height}: ${JSON.stringify(result)}`);
   }
   await check('#systemWelcome');
   if(process.env.BRIEFING_SCREENSHOT&&width===1024)await page.screenshot({path:process.env.BRIEFING_SCREENSHOT.replace('.png','-welcome.png')});
   await page.locator('#systemWelcomeContinue').click();await page.locator('#systemBriefing').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('#systemBriefing').classList.contains('panel-enter-active'));
   await page.locator('#systemBriefing').evaluate(async e=>await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
   await check('#systemBriefing');
   if(process.env.BRIEFING_SCREENSHOT&&width===1024)await page.screenshot({path:process.env.BRIEFING_SCREENSHOT});
   await page.locator('#systemBootClose').click();assert(!(await page.locator('#systemBoot').isVisible()));
   console.log(`PASS ${width}x${height}: welcome and daily briefing fit without scrolling; controls visible`);
   if(width===1024){
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>replayDailyBriefing());
    await page.locator('#systemWelcomeContinue').click();await page.locator('#systemBriefing').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#systemBriefing').classList.contains('panel-enter-active'));
    await check('#systemBriefing');await page.locator('#systemBootClose').click();
    await page.emulateMedia({reducedMotion:'no-preference'});console.log('PASS: reduced-motion briefing is fully visible and fits');
   }
  }
  await page.evaluate(()=>replayDailyBriefing());await page.locator('#systemWelcomeContinue').click();await page.locator('#systemBeginDay').click();
  await page.waitForFunction(()=>document.querySelector('.os-module-stage.active')?.dataset.module==='missions');
  console.log('PASS: Briefing Begin Mission still opens Mission Control');await page.close();
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
