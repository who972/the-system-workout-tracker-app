const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('side-system.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function awakeningScore('),source.indexOf('function awakeningPath(')),context);
const score=data=>context.awakeningScores({sit:30,push:20,pushType:'standard',walk:8,walkEffort:1,march:5,marchEffort:1,mobility:2,energy:2,...data});
test('basic chair/wall performance and full moderate walks no longer award C',()=>{
 assert.equal(context.awakeningClass(score({sit:20,push:10,pushType:'wall',walkEffort:2,marchEffort:2})),'D');
 assert.equal(context.awakeningClass(score({pushType:'wall'})),'D');
});
test('C requires both physical average and a minimum in every area',()=>{
 assert.equal(context.awakeningClass({Strength:75,Endurance:90,Conditioning:90}),'C');
 assert.equal(context.awakeningClass({Strength:74,Endurance:100,Conditioning:100}),'D');
 assert.equal(context.awakeningClass({Strength:84,Endurance:85,Conditioning:85}),'D');
});
test('variation, effort, and input limits affect the recorded scores',()=>{
 const values=['wall','incline','knee','standard'].map(pushType=>score({pushType}).Strength);
 assert.deepEqual(values,[61,79,88,100]);
 assert.equal(score({walkEffort:3}).Endurance,65);
 assert.equal(score({sit:-5,push:-5}).Strength,0);
 assert.equal(score({sit:999,push:999}).Strength,100);
});
test('temporary readiness does not change physical class',()=>{
 assert.equal(context.awakeningClass(score({mobility:1,energy:1})),'C');
});
test('reassessment preserves earned attributes, rank, XP, level and training path',()=>{
 const finish=source.slice(source.indexOf(' function finish(){',source.indexOf('function showAwakeningAssessment')),source.indexOf('\n function render(){',source.indexOf('function showAwakeningAssessment')));
 const build={stats:{Strength:80,Endurance:70,Conditioning:65,Mobility:60,Recovery:50,Consistency:45},path:'Strength'};
 const before=JSON.stringify(build.stats);let placementCalls=0,saved;
 const ctx=vm.createContext({freezeTimer(){},calculate:()=>score({sit:1,push:0,walk:0,march:0}),awakeningClass:context.awakeningClass,awakeningPath:()=> 'Balanced',awakeningReason:context.awakeningReason,retake:true,loadBuild:()=>build,BUILD_STATS:Object.keys(build.stats),selectedPath:'Strength',data:{sit:1},saveBuild(){},applyAssessmentPlacement(){placementCalls++},localStorage:{setItem(k,v){saved=JSON.parse(v)}},ASSESSMENT_KEY:'test',el:{classList:{remove(){}}},renderSideSystem(){},done:null});
 vm.runInContext(finish+';finish();',ctx);
 assert.equal(JSON.stringify(build.stats),before);
 assert.equal(build.path,'Strength');assert.equal(placementCalls,0);
 assert.equal(build.assessment.class,'E');assert.equal(saved.rank,'E');
});

test('indoor, outdoor and treadmill walking use the same scale; adapted activities are recorded separately',()=>{
 for(const walkType of ['indoor','outdoor','treadmill']) assert.equal(score({walkType}).Endurance,100);
 assert.equal(score({walkType:'march'}).Endurance,85);
 assert.equal(score({walkType:'seated'}).Endurance,65);
 assert.equal(score({conditioningType:'seated'}).Conditioning,65);
});
