const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const source=fs.readFileSync('health-history.js','utf8');
const window={};vm.runInNewContext(source,{window});
const model=window.SystemHealthHistoryModel;
const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const result=(days,values={})=>({days,date:day(),syncedAt:new Date().toISOString(),daily:model.datesFor(days,day()).map((date,index)=>({date,steps:100+index,...values})),errors:{}});
const tick=()=>new Promise(r=>setImmediate(r));
async function setup(bridge){
 const dom=new JSDOM('<div class="os-module-stage active"><section id="health"><p data-status></p><p data-updated></p><div data-values></div><button id="healthConnectAction">CONNECT</button><small>Today</small></section></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.AndroidHealthConnect=bridge;
 w.eval(source);w.SystemHealthHistoryInstall(w.document.querySelector('#health'));await tick();
 return {dom,w,el:s=>w.document.querySelector(s),range:days=>w.document.querySelector(`[data-health-days="${days}"]`).click()};
}
test('fills sparse dates, preserves zero, and excludes missing/today from daily average',()=>{
 const metric=model.metrics[0],data={daily:[{date:'2026-10-01',steps:0},{date:'2026-10-02',steps:900},{date:'2026-09-30',steps:300}]};
 const series=model.seriesFor(data,7,metric,'2026-10-02');
 assert.equal(series.length,7);assert.equal(series[0].value,null);assert.equal(series[5].value,0);
 const summary=model.summaryFor(series);assert.equal(summary.coverage,3);assert.equal(summary.total,1200);assert.equal(summary.dailyAverage,150);assert.equal(summary.completed,2);
 assert.equal(series[6].partial,true);assert.equal(model.format(0,metric),'0 steps');
});
test('invalid numbers and read errors never become zero-valued chart points',()=>{
 const key='steps',metric=model.metrics[0];
 for(const value of [null,undefined,'12',-1,Infinity,NaN])assert.equal(model.seriesFor({daily:[{date:'2026-10-02',[key]:value}]},7,metric,'2026-10-02')[6].value,null);
 assert.equal(model.seriesFor({daily:[{date:'2026-10-02',steps:12}],errors:{steps:'permission-required'}},7,metric,'2026-10-02')[6].value,null);
 assert.equal(model.summaryFor(model.seriesFor({},7,metric,'2026-10-02')).dailyAverage,null);
});
test('calendar ranges survive month/year boundaries and only accept supported lengths',()=>{
 assert.deepEqual(Array.from(model.datesFor(7,'2026-01-03')),['2025-12-28','2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03']);
 for(const size of [7,14,30])assert.equal(model.datesFor(size,'2026-03-10').length,size);
 for(const size of [0,1,31,365])assert.throws(()=>model.datesFor(size),/range/);
});
test('history transport carries the requested range without changing today reads',async()=>{
 const sent=[],timers=new Map();let seq=0;const window={SystemHealthNative:{postMessage:message=>sent.push(JSON.parse(message))}};
 vm.runInNewContext(fs.readFileSync('health-connect.js','utf8'),{window,setTimeout:fn=>{timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id)});
 const pending=window.AndroidHealthConnect.readHealthHistory(14);assert.equal(sent[0].days,14);assert.equal(sent[0].method,'readHealthHistory');
 window.SystemHealthNative.onmessage({data:JSON.stringify({id:sent[0].id,result:result(14)})});assert.equal((await pending).days,14);assert.equal(timers.size,0);
});
test('switching range rejects late results and metric switching reuses the current range',async()=>{
 const pending=[];let permissions=0;
 const {dom,el,range}=await setup({getStatus:async()=>({availability:'available',permissions:['steps']}),requestPermissions:async()=>permissions++,readHealthHistory:days=>new Promise(resolve=>pending.push({days,resolve}))});
 range(7);await tick();range(30);await tick();
 const seven=pending.filter(p=>p.days===7),thirty=pending.filter(p=>p.days===30);
 seven.forEach(p=>p.resolve(result(7,{steps:99999})));await tick();assert.doesNotMatch(el('[data-history-value]').textContent,/99,999/);
 thirty.forEach(p=>p.resolve(result(30,{steps:0,sleepMinutes:480})));await tick();
 assert.equal(el('[data-history-chart]').querySelectorAll('[data-chart-date]').length,30);assert.equal(el('[data-history-value]').textContent,'0 steps');
 const calls=pending.length;el('select').value='sleepMinutes';el('select').dispatchEvent(new dom.window.Event('change'));assert.equal(el('[data-history-value]').textContent,'8 hr');assert.equal(pending.length,calls);assert.equal(permissions,0);dom.window.close();
});
test('a day can be selected by keyboard and returning to Today clears historical data',async()=>{
 const {dom,w,el,range}=await setup({getStatus:async()=>({availability:'available',permissions:['steps']}),readHealthHistory:async days=>result(days)});
 range(7);await tick();const point=el('[data-chart-date]');point.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(point.getAttribute('aria-pressed'),'true');assert.equal(el('[data-history-value]').textContent,'100 steps');
 range(0);assert.equal(el('[data-values]').hidden,false);assert.equal(el('.health-history').hidden,true);assert.equal(el('[data-history-chart]').childElementCount,0);dom.window.close();
});
test('closing the module and permission revocation cannot leave old history visible',async()=>{
 let granted=true,resolve;
 const {dom,el,range,w}=await setup({getStatus:async()=>({availability:'available',permissions:granted?['steps']:[]}),readHealthHistory:days=>new Promise(r=>resolve=()=>r(result(days,{steps:8888})))});
 range(7);await tick();el('.os-module-stage').classList.remove('active');await tick();resolve();await tick();assert.equal(el('[data-history-chart]').childElementCount,0);
 granted=false;el('.os-module-stage').classList.add('active');await tick();assert.match(el('[data-history-state]').textContent,/Permission needed/);assert.equal(el('[data-history-chart]').childElementCount,0);
 w.SystemHealthHistory.invalidate();dom.window.close();
});
test('empty, unavailable, stale and partial failure responses have distinct states',async()=>{
 for(const [state,response,expected] of [
  [{availability:'unavailable',permissions:['steps']},null,/unavailable/],
  [{availability:'available',permissions:['steps']},{...result(7),daily:[]},/No records/],
  [{availability:'available',permissions:['steps']},{...result(7),date:'2000-01-01'},/day changed/],
  [{availability:'available',permissions:['steps']},{...result(7),errors:{steps:'health-read-failed'}},/Read failed/]
 ]){
  const {dom,el,range}=await setup({getStatus:async()=>state,readHealthHistory:async()=>response});range(7);await tick();assert.match(el('[data-history-state]').textContent,expected);dom.window.close();
 }
});
