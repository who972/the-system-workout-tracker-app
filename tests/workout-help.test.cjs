const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(f,(e,b)=>{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.statusCode=e?404:200;res.end(e?'':b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:915,height:412},serviceWorkers:'block'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(400);await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
 await page.evaluate(()=>{enterMainInterface();window.SystemOS.open('profile')});
 await page.locator('#osModuleBody [data-replay-tutorial]').click();
 for(let i=0;i<8;i++){assert.match(await page.locator('#systemTutorial small').textContent(),new RegExp((i+1)+' / 8'));await page.locator('#nextSystemTutorial').click()}
 assert.equal(await page.locator('#systemTutorial.active').count(),0);
 await page.evaluate(()=>{localStorage.setItem('systemOnboardingV2',JSON.stringify({tutorialPending:true,assessmentPending:true}));SystemTutorial.offer()});
 assert.equal(await page.locator('#systemTutorial.active').count(),0);
 await page.evaluate(()=>{localStorage.setItem('systemAwakeningAssessmentV1',JSON.stringify({scores:{Endurance:55}}));localStorage.setItem('systemOnboardingV2',JSON.stringify({tutorialPending:true,assessmentPending:false}));SystemTutorial.offer()});
 assert.equal(await page.locator('#systemTutorial.active').count(),1);await page.locator('#skipSystemTutorial').click();
 await page.evaluate(()=>SystemTutorial.offer());assert.equal(await page.locator('#systemTutorial.active').count(),0);
 const supported=await page.evaluate(()=>BUILTIN_EXERCISES.filter(x=>!SystemExerciseGuide.lookup(x.name)).map(x=>x.name));assert.deepEqual(supported,['Cardio Machine']);
 for(const [width,height] of [[568,240],[740,360],[915,412]]){
 await page.setViewportSize({width,height});
 await page.evaluate(()=>{SystemTutorial.show()});
 const reach=async id=>{const r=await page.locator(id).evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,reachable:hit===e||e.contains(hit)}});assert(r.top>=0&&r.bottom<=height&&r.reachable,JSON.stringify({width,height,r}))};
 await reach('#nextSystemTutorial');await page.locator('#skipSystemTutorial').click();
 await page.evaluate(()=>{document.getElementById('liveExerciseName').textContent='Push-Ups';SystemExerciseGuide.open()});
 assert.equal(await page.locator('#exerciseGuide svg').count(),2);await reach('#closeExerciseGuide');await page.locator('#closeExerciseGuide').click();
 }
 await page.evaluate(()=>{document.getElementById('liveExerciseName').textContent='<custom exercise>';SystemExerciseGuide.open()});
 assert.equal(await page.locator('#exerciseGuide svg').count(),0);assert.match(await page.locator('#exerciseGuide').innerText(),/not available/);await page.keyboard.press('Escape');
 const before=await page.evaluate(()=>({xp:state.totalXp,level:state.level}));
 await page.evaluate(()=>{startWorkoutMode()});await page.waitForTimeout(800);await page.locator('#openExerciseGuide').click();
 assert.match(await page.locator('#exerciseGuide h2').textContent(),/./);await page.locator('#closeExerciseGuide').click();assert.equal(await page.locator('#workoutMode.active').count(),1);
 assert.deepEqual(await page.evaluate(()=>({xp:state.totalXp,level:state.level})),before);
 console.log('Guides: built-in movement coverage, custom fallback, actual session entry, no XP mutation. Tutorial: setup gate, skip, replay, all steps, reachable footers at three landscape sizes.');
}finally{await browser?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
