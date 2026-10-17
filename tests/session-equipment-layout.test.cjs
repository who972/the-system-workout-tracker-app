const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('styles.css','utf8');
const dock=html.match(/<div class="os-dock__primary">.*?<\/div><button class="core-action".*?<\/button><\/div>/)[0];
for(const [width,height] of [[568,256],[640,360],[740,360],[915,412]]){
 await page.setViewportSize({width,height});await page.setContent('<style>'+css+'</style><body class="system-os-ready"><div class="hud-bottom os-dock">'+dock+'</div></body>');
 const bounds=await page.locator('[data-session-equipment],.core-action').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:x.textContent,x:r.x,y:r.y,w:r.width,h:r.height,reachable:hit===x||x.contains(hit)};}));
 assert.equal(bounds.length,3);for(const b of bounds){assert(b.x>=0&&b.x+b.w<=width&&b.y>=0&&b.y+b.h<=height&&b.h>=32&&b.reachable,`${width}x${height}: ${JSON.stringify(b)}`);}
 for(let i=0;i<bounds.length-1;i++)assert(bounds[i].x+bounds[i].w<=bounds[i+1].x,`${width}: overlapping controls`);
 console.log(`${width}x${height}: workout switch and Begin Mission fit and are reachable`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
