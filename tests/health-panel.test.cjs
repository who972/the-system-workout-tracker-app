const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const fs=require('node:fs');
async function setup(bridge){
 const dom=new JSDOM('<div class="hud-module" id="playerStatus"></div><div class="hud-module" id="hudHealthTelemetry"><b id="hudSteps">--</b><b id="hudActive">--</b><b id="hudHealthLink">READY</b></div>',{runScripts:'outside-only'});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 if(bridge) w.AndroidHealthConnect=bridge;
 w.eval(fs.readFileSync('health-connect.js','utf8'));
 await new Promise(r=>setImmediate(r));
 assert.equal(w.document.querySelector('#playerStatus button'),null);
 w.document.querySelector('#openHealthConnect').click();
 await new Promise(r=>setImmediate(r));
 return {dom,w,el:s=>w.document.querySelector(s.startsWith('[data-')?'#systemHealthConnectDialog '+s:s)};
}
test('browser fallback remains usable',async()=>{
 const {dom,el}=await setup();assert.match(el('[data-status]').textContent,/Android app/);el('[data-close]').click();assert.equal(el('dialog').open,false);dom.window.close();
});
test('partial access displays denied metrics, zero totals, sessions and safe source text',async()=>{
 let calls=0;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:false,permissions:['steps']}),readHealthData:async()=>{calls++;return {steps:0,syncedAt:new Date().toISOString(),exerciseSessions:[{start:new Date().toISOString(),end:new Date().toISOString(),source:'<img src=x onerror=evil()>'}],errors:{heartRate:'permission-required'}}},requestPermissions:async()=>({granted:false})});
 assert.match(el('[data-status]').textContent,/Partially/);assert.match(el('[data-values]').textContent,/0 steps/);assert.match(el('[data-values]').textContent,/Permission needed/);assert.equal(el('[data-values] img'),null);
 const before=calls;el('[data-connect]').click();await new Promise(r=>setImmediate(r));assert.equal(calls,before+1);
 el('[data-close]').click();assert.equal(el('[data-values]').textContent,'');dom.window.close();
});
test('unavailable provider never reads data',async()=>{
 const {dom,el}=await setup({getStatus:async()=>({availability:'provider-update-required',permissions:[]}),readHealthData:()=>{throw Error('must not read')}});assert.match(el('[data-status]').textContent,/Install or update/);dom.window.close();
});
test('late health response is discarded after closing',async()=>{
 let complete;const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['steps']}),readHealthData:()=>new Promise(r=>complete=r)});
 el('[data-close]').click();complete({steps:123});await new Promise(r=>setImmediate(r));assert.equal(el('[data-values]').textContent,'');dom.window.close();
});


test('refresh publishes the same values to the HUD and retains them on close',async()=>{
 let steps=386;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['steps']}),readHealthData:async()=>({steps,activeCalories:0})});
 assert.equal(el('#hudSteps').textContent,'386 steps');
 assert.equal(el('#hudActive').textContent,'0 kcal');
 steps=621;el('[data-refresh]').click();await new Promise(r=>setImmediate(r));
 assert.equal(el('#hudSteps').textContent,'621 steps');
 el('[data-close]').click();assert.equal(el('#hudSteps').textContent,'621 steps');
 dom.window.close();
});


test('foreground reads update all eight HEALTH cards without requesting permissions',async()=>{
 let requests=0;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:false,permissions:['steps']}),requestPermissions:async()=>{requests++},readHealthData:async()=>({steps:12,activeMinutes:18,errors:{heartRate:'permission-required'}})});
 assert.equal(requests,0);assert.equal(el('#hudHealthLink').textContent,'PARTIAL');
 assert.equal(dom.window.document.querySelectorAll('#systemHealthTelemetryPanel .health-metric-card').length,8);
 assert.equal(el('#systemHealthTelemetryPanel [data-metric="activeMinutes"] p').textContent,'18 min');
 el('[data-close]').click();assert.equal(el('#systemHealthTelemetryPanel [data-metric="steps"] p').textContent,'12 steps');dom.window.close();
});
test('revocation clears the current HUD and module instead of showing old connected values',async()=>{
 let granted=true;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:granted,permissions:granted?['steps']:[]}),readHealthData:async()=>({steps:4321})});
 assert.equal(el('#hudSteps').textContent,'4,321 steps');granted=false;
 el('[data-refresh]').click();await new Promise(r=>setImmediate(r));
 assert.equal(el('#hudHealthLink').textContent,'PERMISSIONS');assert.equal(el('#hudSteps').textContent,'--');
 assert.equal(el('#systemHealthTelemetryPanel [data-metric="steps"] p').textContent,'Permission needed');dom.window.close();
});
test('close and reopen can read again while a discarded earlier request is pending',async()=>{
 const pending=[];let calls=0;
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['steps']}),readHealthData:()=>++calls===1?Promise.resolve({steps:1}):new Promise(r=>pending.push(r))});
 el('[data-close]').click();el('#openHealthConnect').click();await new Promise(r=>setImmediate(r));
 assert.equal(pending.length,2);
 pending[0]({steps:999});await new Promise(r=>setImmediate(r));
 assert.equal(el('[data-refresh]').disabled,true);assert.notEqual(el('#hudSteps').textContent,'999 steps');
 pending[1]({steps:42});await new Promise(r=>setImmediate(r));
 assert.equal(el('[data-refresh]').disabled,false);assert.equal(el('#hudSteps').textContent,'42 steps');dom.window.close();
});
test('a previous-day read never becomes today’s telemetry',async()=>{
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['steps']}),readHealthData:async()=>({steps:999,date:'2000-01-01'})});
 assert.equal(el('#hudSteps').textContent,'--');assert.equal(el('#hudHealthLink').textContent,'REFRESH NEEDED');assert.match(el('[data-status]').textContent,/local day changed/);dom.window.close();
});

test('errors after permission check change link state while retaining successful metrics',async()=>{
 let errors={heartRate:'permission-required'};
 const {dom,el}=await setup({getStatus:async()=>({availability:'available',connected:true,permissions:['all']}),readHealthData:async()=>({steps:12,errors})});
 assert.equal(el('#hudHealthLink').textContent,'PARTIAL');assert.equal(el('#hudSteps').textContent,'12 steps');
 errors={activeCalories:'health-read-failed'};el('[data-refresh]').click();await new Promise(r=>setImmediate(r));
 assert.equal(el('#hudHealthLink').textContent,'READ FAILED');assert.equal(el('#hudSteps').textContent,'12 steps');dom.window.close();
});
