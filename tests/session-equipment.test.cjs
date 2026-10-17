const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=source.indexOf('const SYSTEM_MISSIONS ='),end=source.indexOf('function missionRecordsKey()');
let today='2026-10-19',weekday=1;class TestDate extends Date{getDay(){return weekday;}}const data=new Map();const profile={path:'Balanced',profile:{experience:'Intermediate',equipment:['No Equipment'],days:4}};
const ctx={Date:TestDate,localStorage:{get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))},getTodayStr:()=>today,workoutHistory:()=>[],dateLocal:s=>new Date(s+'T12:00:00'),document:{querySelectorAll:()=>[]},confirm:()=>true};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);data.set('systemPlayerBuildV1',JSON.stringify(profile));ctx.renderSystemMission=()=>{};
assert.equal(ctx.sessionEquipmentType(),'bodyweight');const original=data.get('systemPlayerBuildV1');
ctx.setSessionEquipment('gym');assert.equal(ctx.sessionEquipmentType(),'gym');assert.equal(data.get('systemPlayerBuildV1'),original);
assert.deepEqual(Array.from(ctx.adaptiveSystemMission().profile.equipment),['Full Gym']);
assert(ctx.missionProgressKey().endsWith(':equipment-gym'));
ctx.setSessionEquipment('bodyweight');assert.deepEqual(Array.from(ctx.adaptiveSystemMission().profile.equipment),['No Equipment']);
// Old sets are retained and cannot be reused against another exercise list.
data.set('systemMissionProgress:'+today+':full',JSON.stringify({'0-0':{done:true,reps:10}}));
assert(ctx.sessionEquipmentLocked());ctx.setSessionEquipment('gym');assert.equal(ctx.sessionEquipmentType(),'bodyweight');
data.delete('systemMissionProgress:'+today+':full');data.set('workoutStartedAt:'+today,'123');ctx.setSessionEquipment('gym');assert.equal(ctx.sessionEquipmentType(),'bodyweight');
data.delete('workoutStartedAt:'+today);data.set('systemMissionResult:'+today,'{"mode":"light"}');assert(ctx.sessionEquipmentLocked());
today='2026-10-20';assert.equal(ctx.sessionEquipmentType(),'bodyweight');assert.equal(ctx.missionProgressKey(),'systemMissionProgress:2026-10-20:full');
// Every weekday uses only bodyweight without an override and gym alternatives where applicable.
for(let day=0;day<7;day++){
 weekday=day;vm.runInContext('systemTrainingSchedule=()=>({isTrainingDay:true});adaptiveWeekStatus=()=>({missed:[],todayDone:false});',ctx);
 ctx.setSessionEquipment('gym');let gym=ctx.adaptiveSystemMission();assert.deepEqual(Array.from(gym.profile.equipment),['Full Gym']);
 ctx.setSessionEquipment('bodyweight');let body=ctx.adaptiveSystemMission();assert(!body.exercises.some(e=>/Barbell|Dumbbell|Goblet|Cardio Machine/.test(e[0])));
}
assert.equal(data.get('systemPlayerBuildV1'),original);console.log('PASS: profile preservation, overrides, progress isolation, lock on start/completion, next-day reset, gym/bodyweight mission generation');
