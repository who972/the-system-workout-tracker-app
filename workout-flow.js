/* Exercise-level progression. Timer expiry stages results; only review saves work. */
(function(root){
'use strict';
class ExerciseClock {
 constructor({now=()=>Date.now(),change=()=>{},cue=()=>{}}={}){this.now=now;this.change=change;this.cue=cue;this.phase='ready';this.paused=false;this.left=0;this.index=0;this.sets=[];this.lastCue=null;}
 snapshot(){return {phase:this.phase,paused:this.paused,left:this.left,index:this.index,total:this.sets.length};}
 emit(){this.change(this.snapshot());}
 load(sets){this.sets=sets;this.index=0;this.phase='ready';this.paused=false;this.left=0;this.emit();}
 enter(phase,seconds){this.phase=phase;this.left=seconds;this.deadline=this.now()+seconds*1000;this.lastCue=null;this.cue(phase);this.emit();}
 start(){if(this.phase==='ready')this.enter('prepare',3);}
 tick(){if(this.paused||!['prepare','work','rest'].includes(this.phase))return;
  this.left=Math.max(0,Math.ceil((this.deadline-this.now())/1000));
  if(this.left>0&&this.left<=3&&this.lastCue!==this.left){this.lastCue=this.left;this.cue('countdown');}
  if(this.left===0){if(this.phase==='prepare')this.enter('work',this.sets[this.index].seconds);else if(this.phase==='work')this.finishSet();else{this.index++;this.enter('prepare',3);}}else this.emit();
 }
 finishSet(){if(this.phase!=='work')return;
  if(this.index===this.sets.length-1){this.phase='review';this.left=0;this.cue('ready');this.emit();}
  else if(this.sets[this.index].rest>0)this.enter('rest',this.sets[this.index].rest);
  else{this.index++;this.enter('prepare',3);}
 }
 toggle(){if(!['prepare','work','rest'].includes(this.phase))return;
  if(this.paused){this.deadline=this.now()+this.left*1000;this.paused=false;}else{this.left=Math.max(0,(this.deadline-this.now())/1000);this.paused=true;this.cue('stop');}this.emit();
 }
 extend(){if(!['work','rest'].includes(this.phase))return;this.left+=15;if(!this.paused)this.deadline+=15000;this.lastCue=null;this.emit();}
 advance(){if(this.paused)return;if(this.phase==='work')this.finishSet();else if(this.phase==='rest'){this.index++;this.enter('prepare',3);}}
 stop(){this.phase='ready';this.paused=false;this.left=0;this.cue('stop');this.emit();}
}
if(typeof module!=='undefined'&&module.exports){module.exports={ExerciseClock};return;}
root.SystemExerciseClock=ExerciseClock;
const byId=id=>document.getElementById(id);
let screenAwake=false;
let clock,sets=[],draft=[],saving=false,active=false,pulseTimer,signalContext,signalNodes=[],interval;
const original={render:renderLiveSet,complete:completeLiveSet,close:closeWorkout};
const together=()=>byId('ttLive')&&!byId('ttLive').hidden;
function stopSignals(){clearTimeout(pulseTimer);byId('workoutMode')?.classList.remove('flow-pulse');navigator.vibrate?.(0);for(const n of signalNodes){try{n.stop();}catch(_){}}signalNodes=[];}
function signal(kind){
 if(kind==='stop'){stopSignals();return;}
 const settings=getSystemSettings();
 if(settings.workoutFlashes!==false&&!root.matchMedia('(prefers-reduced-motion: reduce)').matches){const el=byId('workoutMode');el.dataset.flowCue=kind;el.classList.remove('flow-pulse');void el.offsetWidth;el.classList.add('flow-pulse');clearTimeout(pulseTimer);pulseTimer=setTimeout(()=>el.classList.remove('flow-pulse'),450);}
 if(settings.workoutVibration!==false)navigator.vibrate?.(kind==='countdown'?70:[150,80,150]);
 if(!settings.sounds)return;
 try{
  signalContext ||= new (root.AudioContext||root.webkitAudioContext)();
  if(signalContext.state==='suspended')signalContext.resume().catch(()=>{});
  const volume=Math.min(.65,Math.max(0,Number(settings.masterVolume??70)/100*Number(settings.workoutAlertVolume??90)/100*.65));
  const notes={prepare:[],countdown:[780],work:[660,1040],rest:[520,330],ready:[660,880,1100]}[kind]||[];
  notes.forEach((hz,i)=>{const o=signalContext.createOscillator(),g=signalContext.createGain(),t=signalContext.currentTime+i*.16;o.type='triangle';o.frequency.value=hz;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.setValueAtTime(volume,t+.1);g.gain.linearRampToValueAtTime(0,t+.15);o.connect(g);g.connect(signalContext.destination);o.start(t);o.stop(t+.16);signalNodes.push(o);o.onended=()=>{signalNodes=signalNodes.filter(n=>n!==o);o.disconnect();g.disconnect();};});
 }catch(_){}
}
function draw(s){
 if(!byId('exerciseFlow'))return;
 const awake=active&&!document.hidden;if(awake!==screenAwake){screenAwake=awake;root.SystemAndroid?.keepWorkoutScreenOn?.(awake);}
 byId('flowPhase').textContent=s.paused?'PAUSED':({ready:'READY',prepare:'GET READY',work:'WORK',rest:'REST',review:'EXERCISE COMPLETE'})[s.phase];
 byId('flowClock').textContent=s.phase==='ready'?'READY':s.phase==='review'?'REVIEW':fmt(Math.ceil(s.left));
 byId('flowSet').textContent='SET '+(s.index+1)+' OF '+s.total;
 byId('flowPause').textContent=s.paused?'RESUME':'PAUSE';
 byId('flowPause').hidden=!['prepare','work','rest'].includes(s.phase);
 byId('flowExtend').hidden=!['work','rest'].includes(s.phase);
 byId('flowAdvance').hidden=!['work','rest'].includes(s.phase);
 byId('flowAdvance').disabled=s.paused;
 byId('flowAdvance').textContent=s.phase==='rest'?'SKIP REST':'FINISH SET';
 byId('flowStart').hidden=s.phase!=='ready';
 byId('flowReview').hidden=s.phase!=='review';
 byId('flowHint').textContent=s.phase==='ready'?'Start once. Sets and rests run automatically.':s.phase==='work'?'Move at your own pace. Extend time whenever needed.':s.phase==='rest'?'Next set begins automatically after rest.':s.phase==='review'?'Confirm what you actually completed. Adjust any set below.':'Get into position.';
 if(s.phase==='review'&&!byId('flowReviewRows').children.length)renderReview();
}
function renderReview(){
 byId('flowReviewRows').replaceChildren();
 const timed=!!timedTargetSeconds(sets[0]?.target);const effort=byId('flowEffort');[...effort.options].forEach((o,i)=>{o.textContent=timed?['Not sure','Could not maintain control / too hard','Controlled, but hard','All sets controlled · could continue briefly','All sets controlled · plenty left','All sets controlled · easy'][i]:['Not sure','0 — form broke down / no more','Controlled · 1 left','All sets controlled · 2 left','All sets controlled · 3 left','All sets controlled · 4+ left'][i];});
 sets.forEach((set,i)=>{const row=document.createElement('div');row.className='flow-review-row';const label=document.createElement('span');label.textContent='Set '+(set.si+1);row.append(label);
  for(const [key,title,step] of [['reps',timedTargetSeconds(set.target)?'Seconds':'Reps',1],['weight','Weight (lb)',.5]]){const wrap=document.createElement('label');wrap.textContent=title;const input=document.createElement('input');input.type='number';input.min='0';input.step=String(step);input.value=draft[i][key];input.dataset.flowField=key;input.dataset.flowRow=String(i);wrap.append(input);row.append(wrap);}byId('flowReviewRows').append(row);
 });
}
function enableForCurrent(){
 active=!together();byId('exerciseFlow').hidden=!active;
 byId('workoutMode').classList.toggle('auto-exercise',active);
 if(!active){clock.stop();return;}
 clearInterval(restTimer);stopTimedSet();byId('restPanel').hidden=true;
 const m=missionForMode(adaptiveSystemMission()),all=flatSets(m),current=all[liveIndex];if(!current)return;
 const progress=getMissionProgress();sets=all.map((x,index)=>({...x,index})).filter(x=>x.ei===current.ei&&x.index>=liveIndex&&!progress[x.ei+'-'+x.si]?.done);
 draft=sets.map(x=>({reps:timedTargetSeconds(x.target)||parseTargetReps(x.target)||1,weight:Number(byId('liveWeight').value)||0}));
 byId('flowReviewRows').replaceChildren();byId('flowError').textContent='';byId('flowEffort').value='';
 byId('flowPrescription').textContent=current.target+' · '+sets.length+' sets · '+current.rest+'s rest';
 byId('flowWeight').value=draft[0]?.weight||'';
 byId('flowWeightLabel').hidden=!/Dumbbell|Barbell|Goblet|Machine|Cable|Kettlebell/.test(current.name);
 clock.load(sets.map(x=>({seconds:timedTargetSeconds(x.target)||Math.max(20,parseTargetReps(x.target)*(/\/leg/i.test(x.target)?6:3)),rest:x.rest})));
 document.querySelector('.workout-stage').scrollTop=0;byId('workoutMode').scrollTop=0;
}
async function confirmExercise(){
 if(saving||clock.phase!=='review')return;
 const values=draft.map(x=>({...x}));
 byId('flowReviewRows').querySelectorAll('input').forEach(input=>values[Number(input.dataset.flowRow)][input.dataset.flowField]=Number(input.value));
 const weighted=/Dumbbell|Barbell|Goblet/.test(sets[0].name);
 if(values.some(v=>!Number.isFinite(v.reps)||v.reps<0||!Number.isFinite(v.weight)||v.weight<0||(weighted&&v.reps>0&&v.weight<=0))){byId('flowError').textContent='Review reps, seconds and working weights. Enter 0 reps for an unfinished set.';return;}
 saving=true;byId('flowConfirm').disabled=true;
 try{
  const p=getMissionProgress(),rir=byId('flowEffort').value;
  sets.forEach((x,i)=>{p[x.ei+'-'+x.si]={done:values[i].reps>0,reps:values[i].reps,weight:values[i].weight,rir:i===sets.length-1&&rir!==''?Number(rir):null,pain:false,confirmed:true,formConfirmed:rir!==''&&Number(rir)>=1};});
  saveMissionProgress(p);
  const all=flatSets(missionForMode(adaptiveSystemMission()));
  liveIndex=all.findIndex(x=>!p[x.ei+'-'+x.si]?.done);if(liveIndex<0)liveIndex=all.length;
  if(liveIndex>=all.length)finishWorkout();else{saving=false;renderLiveSet();signal('ready');}
 }finally{saving=false;byId('flowConfirm').disabled=false;}
}
renderLiveSet=function(){original.render();if(clock&&!saving)enableForCurrent();};
completeLiveSet=function(){if(!active)return original.complete();if(clock.phase==='work'){draft[clock.index].reps=Number(byId('liveReps').value)||draft[clock.index].reps;clock.advance();}};
closeWorkout=function(){active=false;clock?.stop();stopSignals();original.close();};
function init(){
 const host=document.createElement('section');host.id='exerciseFlow';host.hidden=true;host.setAttribute('aria-label','Automatic exercise progression');
 host.innerHTML='<div class="flow-heading"><strong id="flowPhase" role="status">READY</strong><span id="flowSet"></span></div><p id="flowPrescription"></p><div id="flowClock" class="flow-clock">READY</div><p id="flowHint"></p><label id="flowWeightLabel">Working weight (lb)<input id="flowWeight" type="number" min="0" step="0.5" inputmode="decimal"></label><button id="flowStart" type="button">START EXERCISE</button><div class="flow-controls"><button id="flowPause" type="button">PAUSE</button><button id="flowExtend" type="button">+15 SECONDS</button><button id="flowAdvance" type="button">FINISH SET</button></div><div id="flowReview" hidden><div id="flowReviewRows"></div><label>Were all sets controlled? Good reps left after the final set? <select id="flowEffort"><option value="">Not sure</option><option value="0">0 — form broke down / no more</option><option value="1">Controlled · 1 left</option><option value="2">All sets controlled · 2 left</option><option value="3">All sets controlled · 3 left</option><option value="4">All sets controlled · 4+ left</option></select></label><button id="flowConfirm" type="button">CONFIRM EXERCISE</button></div><p id="flowError" role="alert"></p><details class="flow-alert-options"><summary>Workout alerts</summary><label>Alert volume<input id="flowVolume" type="range" min="0" max="100"></label><label><input id="flowFlash" type="checkbox"> Screen glow</label><label><input id="flowVibrate" type="checkbox"> Vibration</label><button id="flowTest" type="button">TEST ALERT</button><small>Sound follows your sound setting and phone media volume.</small></details>';
 document.querySelector('.workout-stage').append(host);
 clock=new ExerciseClock({change:draw,cue:signal});
 byId('flowStart').onclick=()=>{if(together())return;const w=Number(byId('flowWeight').value);if(!Number.isFinite(w)||w<0||(!byId('flowWeightLabel').hidden&&/Dumbbell|Barbell|Goblet/.test(sets[0].name)&&w<=0)){byId('flowError').textContent='Enter your working weight after warming up.';return;}byId('flowError').textContent='';draft.forEach(x=>x.weight=w);byId('flowWeightLabel').hidden=true;clock.start();};
 byId('flowPause').onclick=()=>clock.toggle();byId('flowExtend').onclick=()=>clock.extend();byId('flowAdvance').onclick=()=>clock.advance();byId('flowConfirm').onclick=confirmExercise;
 const settings=getSystemSettings();byId('flowVolume').value=settings.workoutAlertVolume??90;byId('flowFlash').checked=settings.workoutFlashes!==false;byId('flowVibrate').checked=settings.workoutVibration!==false;
 for(const [id,key] of [['flowVolume','workoutAlertVolume'],['flowFlash','workoutFlashes'],['flowVibrate','workoutVibration']])byId(id).onchange=()=>{const x=getSystemSettings();x[key]=id==='flowVolume'?Number(byId(id).value):byId(id).checked;saveSystemSettings(x);};
 byId('flowTest').onclick=()=>signal('work');
 byId('openExerciseGuide')?.addEventListener('click',()=>{if(active&&!clock.paused)clock.toggle();});
 byId('exitWorkoutBtn').onclick=closeWorkout;byId('completeLiveSet').onclick=completeLiveSet;
 interval=setInterval(()=>{if(active)clock.tick();},100);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!clock.paused){clock.toggle();stopSignals();}});
 root.addEventListener('pagehide',()=>{clock.stop();stopSignals();clearInterval(interval);});
}
document.addEventListener('DOMContentLoaded',init);
root.SystemWorkoutFlow={get active(){return active;},get state(){return clock?.snapshot();},timer(action){if(!active)return; if(action==='start'){if(clock.phase==='ready')byId('flowStart').click();else if(clock.paused)clock.toggle();}else if(action==='pause'&&!clock.paused)clock.toggle();else if(action==='reset'){clock.stop();byId('flowWeightLabel').hidden=!/Dumbbell|Barbell|Goblet|Machine|Cable|Kettlebell/.test(sets[0]?.name);}},advance:()=>clock?.advance(),pause:()=>{if(clock&&!clock.paused)clock.toggle();},extend:()=>clock?.extend()};
})(typeof window==='undefined'?globalThis:window);
