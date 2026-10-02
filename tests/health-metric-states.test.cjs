const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('health-connect.js','utf8'),{window});
const rows=data=>JSON.parse(JSON.stringify(window.SystemHealthMetricRows(data)));
test('all eight metrics distinguish denied, failed, empty and valid zero',()=>{
 const empty=rows({steps:null,activeCalories:null,totalCalories:null,distanceMeters:null,heartRate:{average:null},exerciseSessions:[],sleepSessions:[]});
 assert.equal(empty.length,8);assert(empty.every(x=>x.state==='no-records'&&x.value==='No records found'));
 for(const {key} of empty){
  assert.equal(rows({errors:{[key]:'permission-required'}}).find(x=>x.key===key).state,'permission-needed');
  assert.equal(rows({errors:{[key]:'health-read-failed'}}).find(x=>x.key===key).state,'read-failed');
 }
 const zero=rows({steps:0,activeCalories:0,totalCalories:0,distanceMeters:0,heartRate:{average:0},exerciseSessions:[],sleepSessions:[]});
 assert(zero.slice(0,5).every(x=>x.state==='value'&&/^0 /.test(x.value)));
 assert(zero.slice(5).every(x=>x.state==='no-records'));
});
test('partial reads retain successful values and session counts',()=>{
 const result=rows({steps:12,totalCalories:1200,errors:{activeCalories:'permission-required',distanceMeters:'health-read-failed'},exerciseSessions:[{}],sleepSessions:[{},{}]});
 assert.equal(result.find(x=>x.key==='steps').value,'12 steps');
 assert.equal(result.find(x=>x.key==='exerciseSessions').value,'1');
 assert.equal(result.find(x=>x.key==='sleepSessions').value,'2');
});
test('HUD receives current readings, preserves zero and distinguishes missing or denied values',()=>{
 const elements={hudSteps:{dataset:{}},hudActive:{dataset:{}}};
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync('health-connect.js','utf8'),context);
 context.document={getElementById:id=>elements[id]};
 context.window.SystemHealthUpdateHUD({steps:386,activeCalories:0});
 assert.equal(elements.hudSteps.textContent,'386 steps');
 assert.equal(elements.hudActive.textContent,'0 kcal');
 context.window.SystemHealthUpdateHUD({steps:621,activeCalories:null});
 assert.equal(elements.hudSteps.textContent,'621 steps');
 assert.equal(elements.hudActive.textContent,'--');
 assert.equal(elements.hudActive.dataset.state,'no-records');
 context.window.SystemHealthUpdateHUD({steps:621,errors:{steps:'permission-required'}});
 assert.equal(elements.hudSteps.textContent,'--');
 assert.equal(elements.hudSteps.title,'Permission needed');
});
