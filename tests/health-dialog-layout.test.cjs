// Real app DOM/CSS, native dialog, and mocked Health Connect transport.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try {
  const html=fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  for(const [width,height] of [[740,360],[844,390],[915,412],[960,432]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('**/*',r=>r.abort());
   await page.setContent(html);
   await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
   await page.addStyleTag({content:fs.readFileSync('window-layout.css','utf8')});
   await page.evaluate(()=>{
    document.body.classList.add('system-os-ready');
    window.AndroidHealthConnect={getStatus:async()=>({availability:'available',connected:false,permissions:[]}),requestPermissions:async()=>({granted:false})};
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
   await page.evaluate(()=>{const data=document.querySelector('[data-values]');data.innerHTML=Array.from({length:60},()=>'<p>Long session history</p>').join('');document.querySelector('.health-connect-window-body').scrollTop=99999});
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
  console.log('PASS: Health dialog visible with real OS CSS, centered at four landscape sizes, closes cleanly, and opens from the HEALTH tab');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
