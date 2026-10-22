const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('side-system.js','utf8');
const data=new Map();
const context=vm.createContext({console,Date,JSON,Math,Number,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},window:{},document:{addEventListener(){}},setTimeout(){},setInterval(){},clearInterval(){}});
vm.runInContext(source,context);
vm.runInContext(`
var state={level:12,xp:305,totalXp:999,performanceProfile:{end:{score:3,actions:2}}};
function ensurePerformanceProfile(){return state.performanceProfile}
function saveState(){}
function renderAll(){}
function renderAnalytics(){}
renderSideSystem=function(){};renderPlayerStatus=function(){};
`,context);
const run=s=>vm.runInContext(s,context);
assert.equal(run("enduranceAssessmentScore(6,1,'walk')"),62);
assert.equal(run("enduranceAssessmentScore(6,1,'march')"),59);
assert.equal(run("enduranceAssessmentScore(0,1,'walk')"),0);
run(`localStorage.setItem(ASSESSMENT_KEY,JSON.stringify({rank:'E',placementLevel:9,completedAt:'2026-10-13',scores:{Strength:70,Endurance:0,Conditioning:62,Mobility:50,Recovery:50},raw:{walk:0}}));saveBuild({path:'Strength',stats:{Strength:75,Endurance:3,Consistency:44},assessment:{date:'2026-10-13'}});`);
assert.equal(run("correctEnduranceAssessment(6,1,'walk')"),true);
assert.equal(run("JSON.parse(localStorage.getItem(ASSESSMENT_KEY)).scores.Endurance"),62);
assert.equal(run("JSON.parse(localStorage.getItem(ASSESSMENT_KEY)).rank"),'C');
assert.equal(run("loadBuild().stats.Endurance"),65);
assert.equal(run("loadBuild().stats.Consistency"),44);
assert.equal(run("state.performanceProfile.end.score"),65);
assert.equal(run("state.xp"),305);
assert.equal(run("state.totalXp"),999);
assert.equal(run("JSON.parse(localStorage.getItem(ASSESSMENT_KEY)).completedAt"),'2026-10-13');
const level=run('state.level');
run("correctEnduranceAssessment(6,1,'walk')");
assert.equal(run('state.level'),level);
assert.equal(run('loadBuild().stats.Endurance'),65);
assert.equal(run("correctEnduranceAssessment(7,1,'walk')"),false);
console.log('Endurance scoring and correction preserve progress; repeated save is idempotent.');
