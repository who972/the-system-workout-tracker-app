const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const fs=require('node:fs');
async function setup(bridge){
 const dom=new JSDOM('<div class="hud-module"></div>',{runScripts:'outside-only'});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 if(bridge) w.AndroidHealthConnect=bridge;
 w.eval(fs.readFileSync('health-connect.js','utf8'));
 await new Promise(r=>setImmediate(r));
 w.document.querySelector('.hud-module button').click();
 await new Promise(r=>setImmediate(r));
 return {dom,w,el:s=>w.document.querySelector(s)};
}
test('browser fallback remains usable',async()=>{
 const {dom,el}=await setup();assert.match(el('[data-status]').textContent,/Android app/);el('[data-close]').click();assert.equal(el('dialog').open,false);dom.window.close();
});
test('partial access displays denied metrics, zero totals, sessions and safe source text',async()=>{
 let calls=0;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:false,permissions:['steps']}),readHealthData:async()=>{calls++;return {steps:0,syncedAt:new Date().toISOString(),exerciseSessions:[{start:new Date().toISOString(),end:new Date().toISOString(),source:'<img src=x onerror=evil()>'}],errors:{heartRate:'permission-required'}}},requestPermissions:async()=>({granted:false})});
 assert.match(el('[data-status]').textContent,/Partially/);assert.match(el('[data-values]').textContent,/0 steps/);assert.match(el('[data-values]').textContent,/Permission required/);assert.equal(el('[data-values] img'),null);
 el('[data-connect]').click();await new Promise(r=>setImmediate(r));assert.equal(calls,2);
 el('[data-close]').click();assert.equal(el('[data-values]').textContent,'');dom.window.close();
});
test('unavailable provider never reads data',async()=>{
 const {dom,el}=await setup({getStatus:async()=>({availability:'provider-update-required',permissions:[]}),readHealthData:()=>{throw Error('must not read')}});assert.match(el('[data-status]').textContent,/Install or update/);dom.window.close();
});
test('late health response is discarded after closing',async()=>{
 let complete;const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['steps']}),readHealthData:()=>new Promise(r=>complete=r)});
 el('[data-close]').click();complete({steps:123});await new Promise(r=>setImmediate(r));assert.equal(el('[data-values]').textContent,'');dom.window.close();
});
