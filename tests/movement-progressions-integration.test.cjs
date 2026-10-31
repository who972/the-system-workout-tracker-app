const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const d=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://appassets.androidplatform.net/assets/www/index.html',runScripts:'outside-only',pretendToBeVisual:true});const w=d.window,errors=[],intervals=[];let now=Date.now();
w.Date.now=()=>now;w.matchMedia=()=>({matches:false});w.alert=()=>{};w.confirm=()=>true;w.fetch=async()=>({ok:false,json:async()=>({})});w.HTMLCanvasElement.prototype.getContext=()=>null;w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};w.clearInterval=()=>{};w.setTimeout=(fn,ms)=>{if(ms===650)fn();return 0;};w.addEventListener('error',e=>errors.push(e.message));
for(const f of ['account-data.js','sleep-tracker.js','health-insights.js','app.js','health-connect.js','side-system.js','movement-progressions.js','workout-help.js','system-assistant.js','adaptive-training.js','train-together.js','competitive-credits.js','workout-flow.js'])vm.runInContext(fs.readFileSync(f,'utf8'),d.getInternalVMContext());
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert.deepEqual(errors,[]);
const el=id=>w.document.getElementById(id);const run=s=>vm.runInContext(s,d.getInternalVMContext());

const date=w.systemMissionKey(),before=n=>new Date(Date.parse(date+'T12:00:00')-n*86400000).toISOString().slice(0,10);
const history=[5,3].map(n=>({date:before(n),trainingPolicy:1,workoutMode:'full',split:'full',expectedSets:{'Knee Push-Ups':2},sets:[0,1].map(i=>({name:'Knee Push-Ups',reps:10,weight:0,rir:i?2:null,formConfirmed:true,prescribedTarget:'6-10 reps',pain:false}))}));
w.localStorage.setItem('systemWorkoutSessions',JSON.stringify(history));
w.localStorage.setItem('systemPlayerBuildV1',JSON.stringify({path:'Balanced',assessment:{raw:{pushType:'knee',push:10}},profile:{trainingVersion:1,trainingStyle:'bodyweight',experience:'Beginner',equipment:['No Equipment'],days:3,minutes:45}}));run('state.level=20;systemTrainingSchedule=()=>({isTrainingDay:true,trainingDays:[0,1,2,3,4,5,6]})');
w.renderSystemMission();let button=[...w.document.querySelectorAll('.movement-progression button')].find(b=>b.textContent==='TRY NEXT VARIATION');assert(button,'earned progression offer exists');button.click();let plan=w.adaptiveSystemMission();assert(plan.exercises.some(e=>e[0]==='Push-Ups'&&e[1]===1&&e[2]==='6-10 reps'));
assert(w.document.querySelector('.movement-progression-note').textContent.includes('TRIAL'));
// Keep previous is one tap and persists; accepting again never changes a live session.
[...w.document.querySelectorAll('.movement-progression button')].find(b=>b.textContent==='USE PREVIOUS VARIATION').click();assert(w.adaptiveSystemMission().exercises.some(e=>e[0]==='Knee Push-Ups'));
w.localStorage.removeItem('systemMissionTraining:'+date+':variationChoices');w.localStorage.removeItem('systemProgressionMovementV1');w.renderSystemMission();[...w.document.querySelectorAll('.movement-progression button')].find(b=>b.textContent==='TRY NEXT VARIATION').click();
w.startWorkoutMode();const frozen=JSON.stringify(w.adaptiveSystemMission().exercises);w.renderSystemMission();assert([...w.document.querySelectorAll('.movement-progression button')].every(b=>b.disabled));assert.equal(JSON.stringify(w.adaptiveSystemMission().exercises),frozen);
const tick=intervals.filter(x=>x.ms===100).at(-1).fn;const advance=()=>{now+=1000000;tick();};
for(let n=0;n<30&&!w.localStorage.getItem('systemMissionResult:'+date);n++){el('flowStart').click();for(let i=0;i<100&&w.SystemWorkoutFlow.state.phase!=='review';i++)advance();el('flowEffort').value='2';el('flowConfirm').click();}
const result=w.workoutHistory().at(-1);assert(result.sets.every(x=>x.formConfirmed&&x.prescribedTarget));assert(result.variationTrials.includes('Push-Ups'));
const saved=JSON.parse(w.localStorage.getItem('systemProgressionMovementV1'));const tomorrow=new Date(Date.parse(date+'T12:00:00')+86400000).toISOString().slice(0,10);const earned=w.SystemMovementProgression.resolve(saved,w.workoutHistory(),tomorrow);assert.equal(earned.push.name,'Push-Ups');assert.equal(earned.push.trial,null);assert.equal(w.SystemMovementProgression.next('Push-Ups',w.workoutHistory(),tomorrow,99).kind,'maintain','trial is not two full progression sessions');
for(const items of Object.values(w.SystemMovementProgression.ladders))for(const x of items)assert(w.SystemExerciseGuide.lookup(x.name),x.name+' guide');
assert.deepEqual(errors,[]);setImmediate(()=>d.window.close());console.log('PASS real progression flow: assessment baseline, one-tap trial/backoff, frozen session, confirmed form/targets, trial history, earned variation and guide coverage');
