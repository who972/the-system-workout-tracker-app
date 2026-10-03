const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
function setup(){
 const dom=new JSDOM('<body></body>',{url:'https://assessment.test/',runScripts:'outside-only'});
 const w=dom.window;
 w.today=()=> '2026-10-03';w.state={level:35,xp:77};w.saveState=()=>{};
 w.eval(fs.readFileSync('side-system.js','utf8'));
 w.eval('renderSideSystem=()=>{};renderPlayerStatus=()=>{};');
 const stats={Strength:90,Endurance:85,Conditioning:80,Mobility:70,Recovery:65,Consistency:55};
 w.localStorage.setItem('systemPlayerBuildV1',JSON.stringify({path:'Strength',stats}));
 return {dom,w,stats,q:s=>w.document.querySelector(s)};
}
test('retake records actual variations, retains choices on Back, and preserves earned progress',()=>{
 const {dom,w,stats,q}=setup();
 try{
  w.SystemOnboarding.assessment(null,{retake:true});
  q('#awSit').value='20';q('#awPush').value='10';q('#awPushType').value='incline';q('#awNext').click();
  assert.equal(q('#awWalkType').options.length,5);
  q('#awWalkType').value='seated';q('#awWalk').value='8';q('#awWalkEffort').value='3';q('#awNext').click();
  q('#awConditioningType').value='seated';q('#awMarch').value='4';q('#awMarchEffort').value='2';q('#awBack').click();
  assert.equal(q('#awWalkType').value,'seated');assert.equal(q('#awWalk').value,'8');assert.equal(q('#awWalkEffort').value,'3');
  q('#awBack').click();assert.equal(q('#awPushType').value,'incline');assert.equal(q('#awPush').value,'10');
  q('#awNext').click();q('#awNext').click();assert.equal(q('#awConditioningType').value,'seated');assert.equal(q('#awMarch').value,'4');
  q('#awNext').click();q('#awNext').click();q('#awNext').click();
  const b=JSON.parse(w.localStorage.getItem('systemPlayerBuildV1'));
  assert.deepEqual(b.stats,stats);assert.equal(b.path,'Strength');
  assert.equal(b.assessment.raw.walkType,'seated');assert.equal(b.assessment.raw.pushType,'incline');
  assert.equal(b.assessment.raw.conditioningType,'seated');assert.equal(b.assessment.scores.Endurance,42);
  assert.equal(w.state.level,35);assert.equal(w.state.xp,77);
  assert.equal(q('#awakeningAssessment').classList.contains('active'),false);
 }finally{dom.window.close()}
});
test('cancel retake makes no saved changes or watch calls',()=>{
 const {dom,w,q}=setup();
 try{
  const before=w.localStorage.getItem('systemPlayerBuildV1');
  w.AndroidHealthConnect=new Proxy({}, {get(){throw new Error('Assessment must not use watch data')}});
  w.SystemOnboarding.assessment(null,{retake:true});q('#awCancel').click();
  assert.equal(w.localStorage.getItem('systemPlayerBuildV1'),before);
  assert.equal(w.localStorage.getItem('systemAwakeningAssessmentV1'),null);
 }finally{dom.window.close()}
});
