const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(root,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({serviceWorkers:'block'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.SystemOS&&document.getElementById('systemAlertBtn'));
  await page.addStyleTag({content:'#systemBoot,#authGate,#systemEntryScreen{display:none!important}'});
  await page.evaluate(()=>{document.querySelectorAll('.system-onboarding').forEach(e=>e.classList.remove('active'));document.body.classList.remove('system-entry-open','system-boot-open');SystemOS.close()});
  for(const [width,height] of [[568,240],[568,256],[640,320],[667,375],[740,360],[812,375],[844,390],[915,412],[960,432],[1024,500],[1536,681]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>{const dock=document.querySelector('.os-dock'),deck=document.getElementById('commandDeck');return parseFloat(deck.style.getPropertyValue('--command-dock-space'))>=dock.getBoundingClientRect().height+7});
   const report=await page.evaluate(()=>{
    const wing=document.querySelector('.hud-wing--right'),dock=document.querySelector('.os-dock'),r=wing.getBoundingClientRect(),d=dock.getBoundingClientRect();
    return {wing:r.toJSON(),dock:d.toJSON(),scroll:wing.scrollHeight-wing.clientHeight,
      buttons:[...dock.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:b.textContent.trim(),rect:r.toJSON(),hit:b.contains(hit),coveredBy:hit?.outerHTML.slice(0,180)}}),
      cards:[...wing.children].map(e=>({h:e.clientHeight,scroll:e.scrollHeight,tag:e.querySelector('.hud-module__tag').textContent}))};
   });
   assert(report.wing.top>=0&&report.wing.right<=width&&report.wing.bottom<=report.dock.top-6,'Right column stays above dock');
   for(const button of report.buttons){assert(button.rect.top>=0&&button.rect.bottom<=height+1,button.label+' visible');assert(button.hit,button.label+' is not covered: '+button.coveredBy);}
   for(const card of report.cards)assert(card.scroll<=card.h+2,card.tag+' content is not clipped');
   if(height>=375)assert(report.scroll<=2,`${width}x${height}: normal landscape needs no panel scrolling`);
   await page.locator('#systemAlertBtn').click();assert.equal(await page.locator('#systemAlertCenter').isVisible(),true);await page.locator('#alertCenterClose').click();
   if(width===915&&process.env.COMMAND_SCREENSHOT)await page.screenshot({path:process.env.COMMAND_SCREENSHOT});
   console.log(`PASS ${width}x${height}: right panels clear the two-row dock, all dock buttons clickable, Alerts opens/closes`);
  }
 }finally{await browser?.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
