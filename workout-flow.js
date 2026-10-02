/* Durable solo sessions; shared sessions retain their server-controlled progression. */
(() => {
 const original={mission:missionForMode,start:startWorkoutMode,render:renderLiveSet,complete:completeLiveSet,
  rest:startRest,endRest,close:closeWorkout,finish:finishWorkout,debrief:showMissionDebrief,progress:getMissionProgress};
 let saved=null,running=false,activeSince=0,restEndsAt=0,tick=null,finishing=false,report=null,reportContext=false;
 const el=id=>document.getElementById(id);
 const shared=()=>missionProgressKey().startsWith('systemTrainTogetherProgress:');
 const key=()=> 'systemMissionResume:'+systemMissionKey()+':'+getWorkoutMode();
 const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}};
 const elapsed=()=>Math.max(0,(saved?.elapsed||0)+(running?Date.now()-activeSince:0));
 function checkpoint(){
  if(!saved||shared()||finishing)return;
  saved.elapsed=elapsed();activeSince=Date.now();saved.index=liveIndex;
  saved.reps=restEndsAt?'':el('liveReps').value;saved.weight=restEndsAt?'':el('liveWeight').value;
  saved.remaining=timedSetEndAt?Math.max(0,Math.ceil((timedSetEndAt-Date.now())/1000)):timedSetRemaining;
  saved.rest=restEndsAt?Math.max(0,Math.ceil((restEndsAt-Date.now())/1000)):0;
  localStorage.setItem(saved.storageKey,JSON.stringify(saved));
 }
 missionForMode=function(m,mode){
  if(reportContext&&report)return report.mission;
  if(!shared()){
   const pending=running&&saved?.storageKey===key()?saved:read(key());
   if(pending?.mission&&(!mode||mode===pending.mission.mode))return pending.mission;
  }
  return original.mission(m,mode);
 };
 getMissionProgress=function(){return reportContext&&report?report.progress:original.progress()};
 startWorkoutMode=function(){
  if(el('workoutMode').classList.contains('active')||running)return;
  const result=read('systemMissionResult:'+systemMissionKey()),m=missionForMode(adaptiveSystemMission());
  if(result?.mode==='full'||(!shared()&&result?.mode===m.mode))return;
  report=null;
  if(!shared()){
   saved=read(key())||{storageKey:key(),mission:JSON.parse(JSON.stringify(m)),elapsed:0,index:-1};
   // Snapshot accepted targets so changes to the profile cannot replace a workout mid-session.
   if(saved.index===-1)saved.mission.exercises=saved.mission.exercises.map(e=>[e[0],e[1],adaptiveTargetFor(e[0],e[2]),e[3]]);
   localStorage.setItem(key(),JSON.stringify(saved));
   running=true;activeSince=Date.now();
   localStorage.setItem('workoutStartedAt:'+systemMissionKey(),Date.now()-saved.elapsed);
  }
  original.start();
  clearInterval(tick);tick=setInterval(()=>{
   if(!shared()&&saved&&running){workoutStartedAt=Date.now()-elapsed();el('workoutClock').textContent=fmt(elapsed()/1000);checkpoint()}
  },1000);
 };
 renderLiveSet=function(){
  original.render();
  const m=missionForMode(adaptiveSystemMission()),x=flatSets(m)[liveIndex];if(!x)return;
  const timed=timedTargetSeconds(x.target),target=timed?x.target:x.target.replace('/leg',' reps per leg');
  el('liveExerciseCount').textContent=`EXERCISE ${x.ei+1} OF ${m.exercises.length} • SET ${x.si+1} OF ${m.exercises[x.ei][1]}`;
  el('liveTarget').textContent=`Target: ${target} • Rest after set: ${x.rest?x.rest+' sec':'none'}`;
  el('liveRepsLabel').textContent=timed?'SECONDS COMPLETED':/\/leg/i.test(x.target)?'REPS PER LEG':'REPS COMPLETED';
  el('liveSetGuidance').textContent=timed?'Start the countdown when ready. Log the seconds you actually complete.':'Complete one set, then enter your actual reps and any weight used.';
  el('liveWeightLabel').textContent='WEIGHT (LB • OPTIONAL)';
  // Actual entries start empty; the target is guidance, not a completed performance.
  el('liveReps').value='';el('liveWeight').value='';
  if(saved&&!shared()&&saved.index===liveIndex){
   el('liveReps').value=saved.reps||'';el('liveWeight').value=saved.weight||'';
   if(timed&&!saved.rest&&Number.isFinite(saved.remaining)){
    timedSetDuration=timed;timedSetRemaining=Math.min(timed,Math.max(0,saved.remaining));updateTimedSetClock();
    el('timedSetStatus').textContent=timedSetRemaining?'Saved countdown — resume when ready.':'Time complete — tap Complete Set.';
   }
   if(saved.rest>0){original.rest(saved.rest);restEndsAt=Date.now()+saved.rest*1000}
  }
  if(!shared()&&saved){el('workoutClock').textContent=fmt(elapsed()/1000);workoutStartedAt=Date.now()-elapsed()}
 };
 completeLiveSet=async function(){
  if(el('restPanel').hidden===false||el('completeLiveSet').disabled)return;
  const reps=Number(el('liveReps').value),weight=Number(el('liveWeight').value);
  if(!el('liveReps').value.trim()||!Number.isFinite(reps)||reps<0||!Number.isFinite(weight)||weight<0){
   el('liveSetGuidance').textContent='Enter the reps or seconds you completed (0 is allowed). Weight must be 0 or more.';el('liveReps').focus();return;
  }
  if(saved&&!shared()){
   saved.index=-1;saved.reps='';saved.weight='';delete saved.remaining;saved.rest=0;
  }
  await original.complete();checkpoint();
 };
 startRest=function(seconds){restEndsAt=Date.now()+seconds*1000;original.rest(seconds);checkpoint()};
 endRest=function(){restEndsAt=0;if(saved){saved.rest=0;saved.index=-1;}original.endRest();checkpoint()};
 function pause(){
  if(!running)return;
  checkpoint();running=false;
  if(timedSetEndAt){stopTimedSet();updateTimedSetClock();el('timedSetStatus').textContent='Paused — resume when ready.'}
  clearInterval(liveTimer);clearInterval(restTimer);clearInterval(tick);restEndsAt=0;
 }
 closeWorkout=function(){
  if(!shared())pause();original.close();el('restPanel').hidden=true;
  if(!finishing){renderSystemMission();if(typeof renderPlayerStatus==='function')renderPlayerStatus()}
 };
 finishWorkout=function(){
  const m=missionForMode(adaptiveSystemMission()),p=getMissionProgress(),awardKey='systemMissionAward:'+missionProgressKey();
  if(finishing||localStorage.getItem(awardKey)||!flatSets(m).every(x=>p[x.ei+'-'+x.si]?.done))return;
  finishing=true;const resumeKey=shared()?null:saved?.storageKey;
  report={mission:JSON.parse(JSON.stringify(m)),progress:JSON.parse(JSON.stringify(p)),before:{...window.SystemBuild?.getBuild?.()?.stats}};
  if(!shared()&&saved)workoutStartedAt=Date.now()-elapsed();
  try{
   original.finish();localStorage.setItem(awardKey,'true');
   report.after={...window.SystemBuild?.getBuild?.()?.stats};
   const history=workoutHistory(),last=history.at(-1);if(last){
    last.statGains=Object.fromEntries(Object.keys(report.after).map(k=>[k,Math.max(0,(report.after[k]||0)-(report.before[k]||0))]));
    localStorage.setItem('systemWorkoutSessions',JSON.stringify(history));
   }
   if(resumeKey)localStorage.removeItem(resumeKey);saved=null;running=false;clearInterval(tick);
  }finally{finishing=false}
 };
 showMissionDebrief=function(seconds,xp,prs){
  reportContext=!!report;
  try{original.debrief(seconds,xp,prs)}finally{reportContext=false}
  if(report){
   const growth=el('missionDebriefGrowth');growth.replaceChildren();
   for(const [stat,value] of Object.entries(report.after||{})){
    const gain=Math.max(0,value-(report.before[stat]||0));if(!gain)continue;
    const row=document.createElement('span'),name=document.createElement('b'),amount=document.createElement('i');
    name.textContent=stat;amount.textContent='+'+gain+' POINT'+(gain===1?'':'S');row.append(name,amount);growth.append(row);
   }
   if(!growth.children.length)growth.textContent='No additional attribute points this session. Your workout and XP are saved.';
  }
  const hit=workoutHistory().at(-1)?.bossDamage;
  el('missionDebriefBoss').textContent=hit?`${hit.boss}: ${hit.hp.toLocaleString()} / ${hit.maxHp.toLocaleString()} HP remaining${hit.defeated?' • GATE CLEARED':''}`:'Keep training and completing side missions to progress toward your next boss.';
 };
 document.addEventListener('visibilitychange',()=>{
  if(shared()||!saved||!el('workoutMode').classList.contains('active'))return;
  if(document.hidden)pause();else{
   running=true;activeSince=Date.now();renderLiveSet();
   clearInterval(tick);tick=setInterval(()=>{workoutStartedAt=Date.now()-elapsed();el('workoutClock').textContent=fmt(elapsed()/1000);checkpoint()},1000);
  }
 });
 window.addEventListener('pagehide',()=>{if(!shared())pause()});
 document.addEventListener('DOMContentLoaded',()=>{
  el('completeLiveSet').onclick=completeLiveSet;el('exitWorkoutBtn').onclick=closeWorkout;
  for(const id of ['liveReps','liveWeight'])el(id).addEventListener('input',checkpoint);
  for(const id of ['timedSetToggle','timedSetReset'])el(id).addEventListener('click',checkpoint);
  el('restPanel').insertAdjacentHTML('beforeend','<button type="button" id="restSaveExit" class="rest-save-exit">SAVE & EXIT</button>');el('restSaveExit').onclick=closeWorkout;
  el('exitWorkoutBtn').textContent='SAVE & EXIT';el('exitWorkoutBtn').setAttribute('aria-label','Save workout progress and exit');
  el('missionDebriefGrowth').parentNode.insertAdjacentHTML('afterend','<p id="missionDebriefBoss"></p>');
 });
})();
