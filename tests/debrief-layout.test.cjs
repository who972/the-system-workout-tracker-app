const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const f=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(f,(e,b)=>{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.statusCode=e?404:200;res.end(e?'':b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:915,height:412},serviceWorkers:'block'});
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(400);
 for(const [width,height] of [[568,240],[640,320],[740,360],[915,412],[1024,500]]){
 await page.setViewportSize({width,height});
 await page.evaluate(()=>{ensureMissionFx();const e=document.getElementById('missionDebrief');e.classList.add('active');document.getElementById('missionDebriefPr').textContent='CRITICAL HIT // 881 DAMAGE • NEW PR // High Knees • Mountain Climbers • Reverse Lunges • March in Place • Stretching';document.getElementById('missionDebriefGrowth').innerHTML='<span>STRENGTH 70%</span><span>CONDITIONING 62%</span>'});
 await page.waitForTimeout(350);
 const bounds=await page.locator('#missionDebriefClose').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,reachable:hit===e||e.contains(hit)}});
 assert(bounds.top>=0&&bounds.bottom<=height&&bounds.left>=0&&bounds.right<=width&&bounds.height>=44&&bounds.reachable,JSON.stringify({width,height,bounds}));
 const body=page.locator('.mission-debrief__body');await body.evaluate(e=>e.scrollTop=e.scrollHeight);
 await page.locator('#missionDebriefClose').click();assert.equal(await page.locator('#missionDebrief').evaluate(e=>e.classList.contains('active')),false);
 }
 console.log('Debrief return button reachable and closes at five landscape sizes, including 568×240.');
}finally{await browser?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
