const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream'});res.end(err?'':data)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:915,height:412},serviceWorkers:'block'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  async function ready(actual=false){
   await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.SystemOS&&document.getElementById('missionDebriefBoss'));
   await page.evaluate(actual=>{
    document.body.classList.add('system-os-ready');document.getElementById('systemEntryScreen').style.display='none';
    document.getElementById('systemBoot').classList.remove('active');
    if(!actual)adaptiveSystemMission=()=>({name:'Beginner Strength',focus:'Strength',xp:300,exercises:[['Push-Ups',2,'8-12 reps',30],['Plank',1,'30 sec',0]],sourceDay:1});
   },actual);
  }
  async function launch(){await page.evaluate(()=>startWorkoutMode());await page.locator('#workoutMode.active').waitFor();}
  await ready();await launch();
  assert.equal(await page.locator('#liveReps').inputValue(),'');
  await page.locator('#completeLiveSet').click();assert.equal(await page.evaluate(()=>Object.keys(getMissionProgress()).length),0,'Empty entries cannot complete a set');
  await page.locator('#liveReps').fill('8');await page.locator('#liveWeight').fill('0');await page.locator('#completeLiveSet').click();
  assert(await page.locator('#restPanel').isVisible());
  await page.evaluate(()=>closeWorkout());await ready();await launch();
  assert(await page.locator('#restPanel').isVisible(),'Unfinished rest resumes after reload');
  await page.locator('#skipRestBtn').click();assert.match(await page.locator('#liveExerciseCount').textContent(),/SET 2 OF 2/);
  await page.locator('#liveReps').fill('9');await page.locator('#completeLiveSet').click();await page.locator('#skipRestBtn').click();
  await page.locator('#timedSetToggle').click();await page.waitForTimeout(1150);await page.locator('#exitWorkoutBtn').click();
  const paused=await page.evaluate(()=>JSON.parse(localStorage.getItem('systemMissionResume:'+systemMissionKey()+':full')));
  assert(paused.remaining<30&&paused.remaining>0);
  await page.waitForTimeout(1100);await ready();await launch();
  assert.equal(await page.locator('#timedSetClock').textContent(),`00:${String(paused.remaining).padStart(2,'0')}`);
  assert.match(await page.locator('#timedSetToggle').textContent(),/RESUME/);
  await page.evaluate(()=>{document.getElementById('liveReps').value=30});
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500]]){
   await page.setViewportSize({width,height});
   const result=await page.locator('.workout-stage').evaluate(e=>{
    const b=e.getBoundingClientRect();return {overflow:e.scrollHeight-e.clientHeight,bottom:b.bottom,buttons:[...e.querySelectorAll('button')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,top:r.top,bottom:r.bottom,right:r.right}})};
   });
   assert(result.overflow<=1,`${width}x${height}: ${JSON.stringify(result)}`);
   for(const b of result.buttons)assert(b.top>=0&&b.bottom<=height&&b.right<=width,`${width}x${height}: ${JSON.stringify(b)}`);
  }
  console.log('PASS: reps, saved rest, paused countdown, reload and live controls at ten landscape sizes');
  await page.locator('#completeLiveSet').click();await page.locator('#missionDebrief.active').waitFor();
  const complete=await page.evaluate(()=>({history:workoutHistory(),xp:state.totalXp,result:JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey()))}));
  assert.equal(complete.history.length,1);assert.equal(complete.result.mode,'full');assert(complete.history[0].seconds<20,'Away time is excluded');
  assert.match(await page.locator('#missionDebriefGrowth').textContent(),/\+1 POINT/);
  await page.evaluate(()=>finishWorkout());assert.equal(await page.evaluate(()=>workoutHistory().length),1,'Repeated completion cannot duplicate rewards');
  for(const [width,height] of [[568,240],[640,320],[915,412],[1024,500]]){
   await page.setViewportSize({width,height});
   const b=await page.locator('.mission-debrief__card').evaluate(e=>({overflow:e.scrollHeight-e.clientHeight,bottom:e.getBoundingClientRect().bottom}));
   assert(b.overflow<=1&&b.bottom<=height,`${width}x${height}: ${JSON.stringify(b)}`);
  }
  await page.evaluate(()=>{document.getElementById('missionDebrief').classList.remove('active');replayDailyBriefing()});
  assert.equal(await page.locator('.briefing-status').textContent(),'COMPLETED');
  console.log('PASS: one completion reward, real attribute gains, result layout and completed briefing');
  // Exercise the real adaptive beginner mission, including quick-to-full upgrade.
  await page.evaluate(()=>localStorage.clear());await ready(true);
  await page.evaluate(()=>{localStorage.setItem('systemWorkoutMode:'+systemMissionKey(),'light')});await launch();
  async function finishAll(){
   await page.evaluate(async()=>{
    const count=flatSets(missionForMode(adaptiveSystemMission())).length;
    for(let i=0;i<count;i++){
     if(!document.getElementById('restPanel').hidden)endRest();
     document.getElementById('liveReps').value=timedSetDuration||8;await completeLiveSet();
    }
   });await page.locator('#missionDebrief.active').waitFor();
  }
  await finishAll();assert.equal(await page.evaluate(()=>SystemMissionPerformance.mode),'light');
  const quickXp=await page.evaluate(()=>state.totalXp),remainingXp=await page.evaluate(()=>adaptiveSystemMission().xp-JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey())).xp);
  await page.evaluate(()=>{document.getElementById('missionDebrief').classList.remove('active');setWorkoutMode('full')});await launch();await finishAll();
  assert.equal(await page.evaluate(()=>state.totalXp),quickXp+remainingXp,'Upgrade awards only remaining mission XP');
  console.log('PASS: quick mode grading and full-workout upgrade XP');await page.close();
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
