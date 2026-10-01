const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync('health-connect.js','utf8'),{window});
const rows=data=>JSON.parse(JSON.stringify(window.SystemHealthMetricRows(data)));
test('all seven metrics distinguish denied, failed, empty and valid zero',()=>{
 const empty=rows({steps:null,activeCalories:null,totalCalories:null,distanceMeters:null,heartRate:{average:null},exerciseSessions:[],sleepSessions:[]});
 assert.equal(empty.length,7);assert(empty.every(x=>x.state==='no-records'&&x.value==='No records found'));
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
