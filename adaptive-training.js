/* Personalized training policy. Loads and repetitions are suggestions, never inferred 1RM. */
(function(root){
'use strict';
const catalog={
 push:[['Incline Push-Ups','bodyweight'],['Push-Ups','bodyweight'],['Dumbbell Press','Dumbbells'],['Barbell Bench Press','Barbell'],['Band Chest Press','Resistance Bands']],
 pull:[['Prone W Raises','bodyweight'],['Dumbbell Row','Dumbbells'],['Band Row','Resistance Bands']],
 squat:[['Bodyweight Squats','bodyweight'],['Goblet Squat','Dumbbells'],['Barbell Squat','Barbell'],['Band Squat','Resistance Bands']],
 hinge:[['Glute Bridge','bodyweight'],['Dumbbell Romanian Deadlift','Dumbbells'],['Barbell Hip Thrust','Barbell'],['Band Glute Bridge','Resistance Bands']],
 core:[['Dead Bug','bodyweight'],['Plank','bodyweight']],
 cardio:[['Brisk Walk','bodyweight'],['March in Place','bodyweight'],['Cardio Machine','Cardio Machine']]
};
const Movement=root.SystemMovementProgression||(typeof module==='object'&&module.exports?require('./movement-progressions.js'):null);
if(Movement)for(const [family,items] of Object.entries(Movement.ladders)){const pattern={plank:'core',walk:'cardio',burpee:'cardio',climber:'cardio',knees:'cardio',lunge:'squat',bandChest:'push',bandRow:'pull',bandSquat:'squat',bandBridge:'hinge'}[family]||family;catalog[pattern]||=[];for(const item of items)if(!catalog[pattern].some(x=>x[0]===item.name))catalog[pattern].push([item.name,family.startsWith('band')?'Resistance Bands':'bodyweight']);}
const clamp=(x,a,b,d)=>Number.isFinite(Number(x))?Math.max(a,Math.min(b,Number(x))):d;
function profile(build){const p=build.profile||{};return {...p,path:build.path||'Balanced',style:['bodyweight','weights','hybrid'].includes(p.trainingStyle)?p.trainingStyle:'bodyweight',experience:String(p.experience||'beginner').toLowerCase(),minutes:clamp(p.minutes,15,90,30),days:clamp(p.days,2,6,4),increment:clamp(p.increment,.5,20,2.5),equipment:p.equipment||[],avoid:Array.isArray(p.avoid)?p.avoid:[]};}
function movementAllowed(name,p){const avoid=p.avoid||[];if(avoid.includes('impact')&&/Jog|High[- ]Knee/.test(name))return false;if(/Burpee/.test(name)&&avoid.some(x=>['push','squat','core','hinge'].includes(x)))return false;if(/Mountain Climbers/.test(name)&&avoid.some(x=>['push','core'].includes(x)))return false;return true;}
function options(pattern,p,type){const all=catalog[pattern]||[];return all.filter(x=>(x[1]==='bodyweight'||(type==='gym'&&(p.equipment.includes('Full Gym')||p.equipment.includes(x[1]))))&&movementAllowed(x[0],p)).map(x=>x[0]);}
function recommendation(name,target,history,increment=2.5,today){
 const range=String(target).match(/(\d+)(?:-(\d+))?/),low=Number(range?.[1]||8),high=Number(range?.[2]||low);
 if(/sec|min/.test(target)){
 const sessions=Movement?.evidence(name,history,today).slice(-2)||[];const ready=sessions.length===2&&new Set(sessions.map(x=>x.date)).size===2&&sessions.every(s=>Movement.performance(s,name).ready);
 const last=sessions.at(-1),age=last?(Date.parse(today+'T12:00:00')-Date.parse(last.date+'T12:00:00'))/86400000:Infinity;
 const duration=Movement?.seconds(target)||0,cap=/Walk|March|Machine/.test(name)?1200:60,step=/Walk|Machine/.test(name)?30:5;
 return {weight:0,target:ready&&age<=21&&duration<cap?Math.min(cap,duration+step)+' sec':target,reason:ready&&age<=21&&duration<cap?'Two controlled sessions were manageable. Add a little time; keep the same movement.':'Complete the prescribed time with controlled movement. Duration increases need confirmed performance.'};
 }
 const weighted=/Dumbbell|Barbell|Goblet/.test(name),sessions=history.filter(s=>(!today||s.date<today)&&(s.sets||[]).some(x=>x.name===name)).slice(-2);
 if(!sessions.length)return {weight:null,target,reason:weighted?'Starting weight: warm up light. Choose a load you can control for the target reps with 2–3 good reps left. Log working sets only.':'Use controlled movement; finish with 2–3 good reps left.'};
 const last=sessions.at(-1),sets=last.sets.filter(x=>x.name===name&&Number.isFinite(x.reps)&&Number.isFinite(x.weight));
 if(!sets.length)return {weight:null,target,reason:'Find a manageable working load.'};
 const load=Math.min(...sets.map(x=>x.weight)),age=today?(new Date(today+'T12:00:00')-new Date(last.date+'T12:00:00'))/86400000:0;
 const full=s=>s.workoutMode==='full'&&s.trainingPolicy===1&&s.sets.filter(x=>x.name===name).length>=(s.expectedSets?.[name]||999);
 const ready=sessions.length===2&&sessions.every(s=>{const work=s.sets.filter(x=>x.name===name),last=work.at(-1);return full(s)&&work.every(x=>x.reps>=high&&!x.pain&&x.weight===load)&&(work.every(x=>Number.isFinite(x.rir)&&x.rir>=2)||work.every(x=>x.formConfirmed===true)&&Number.isFinite(last?.rir)&&last.rir>=2);});
 const struggle=sets.some(x=>x.reps<low||x.rir===0||x.pain);
 if(age>21)return {weight:weighted?Math.max(0,Math.floor(load*.8/increment)*increment):0,target,reason:'Returning after a break: start below your previous working load and recalibrate.'};
 if(struggle)return {weight:weighted?Math.max(0,Math.floor(load*.9/increment)*increment):0,target,reason:'Recent sets were difficult. Reduce difficulty and rebuild controlled repetitions.'};
 if(ready)return {weight:weighted?Math.round((load+increment)*100)/100:0,target:weighted?target:`${low+1}-${Math.min(high+1,20)} reps`,reason:weighted?'Two complete sessions reached the target with reserve. Try your smallest available weight increase.':'Two complete sessions reached the target with reserve. Try one more repetition per set.'};
 return {weight:weighted?load:0,target,reason:'Keep your last working load and build consistent repetitions. Missing effort feedback never triggers an increase.'};
}
function plan(build,history,today,type,readiness={},substitutions={},movementProgress={}){
 const p=profile(build),prior=history.filter(s=>s.date<today&&s.trainingPolicy===1&&s.workoutMode==='full'&&!s.recovery),count=new Set(prior.map(s=>s.date)).size;
 const split=p.days>=4?(count%2?'lower':'upper'):'full';
 const last=prior.at(-1),gap=last?(new Date(today+'T12:00:00')-new Date(last.date+'T12:00:00'))/86400000:99;
 const recent=history.filter(s=>s.date<today&&s.date>=new Date(new Date(today+'T12:00:00').getTime()-7*86400000).toISOString().slice(0,10)&&!s.recovery&&s.workoutMode==='full');
 const fatigued=readiness.fatigue==='high'||readiness.soreness==='high'||readiness.sleep==='poor',recovery=!!readiness.pain||(gap<2&&(p.days<4||last?.split===split));
 const easy=fatigued||recent.length>=5,sets=p.experience==='beginner'||p.experience==='returning'?2:3;
 const patterns=recovery?['cardio']:split==='upper'?['push','pull','core']:split==='lower'?['squat','hinge','core']:['squat','push','pull','hinge','core'];
 if(!recovery&&(p.path==='Endurance'||p.path==='Fat Loss'))patterns.unshift('cardio');
 const exercises=[],movements={};
 for(const pattern of patterns){if(p.avoid.includes(pattern))continue;const choices=options(pattern,p,type);if(!choices.length)continue;
 let name=(type==='gym'?choices.find(n=>/Dumbbell|Goblet/.test(n))||choices.find(n=>/Barbell|Band |Machine/.test(n)):null)||choices[0];
 if(pattern==='push'&&type==='bodyweight'&&p.experience!=='beginner')name='Push-Ups';
 const raw=build.assessment?.raw;if(pattern==='push'&&type==='bodyweight'&&raw?.push>0){const assessed={wall:'Wall Push-Ups',incline:'Incline Push-Ups',knee:'Knee Push-Ups',standard:'Push-Ups'}[raw.pushType];if(choices.includes(assessed))name=assessed;}
 if(pattern==='cardio'&&raw?.enduranceMode==='march')name='March in Place';
 const initialFamily=Movement?.find(name)?.family,lifting=/Dumbbell|Barbell|Goblet|Band /.test(name);
 for(const saved of Object.values(movementProgress))if(choices.includes(saved.name)&&(!lifting||Movement?.find(saved.name)?.family===initialFamily))name=saved.trial&&(recovery||easy)?saved.trial.from:saved.name;
 if(substitutions[pattern]&&choices.includes(substitutions[pattern]))name=substitutions[pattern];
 const target=Movement?.find(name)?.stage.target||(/Plank|Walk|March|Machine/.test(name)?(/Plank/.test(name)?'20-30 sec':'10 min'):p.path==='Strength'&&/Dumbbell|Barbell|Goblet/.test(name)?'6-8 reps':'8-12 reps');const isTimed=/sec|min/.test(target);
 const rest=isTimed?30:p.path==='Strength'?120:75;const perMovement=Math.max(1,Math.floor((Math.min(p.minutes,Number(readiness.minutes)||p.minutes)-5)/patterns.length/(1+rest/60)));const n=isTimed?1:Math.min(perMovement,easy?Math.max(1,sets-1):sets);
 exercises.push([name,n,target,rest]);movements[name]=pattern;
 }
 // Time budget conservatively allows setup, working sets, rest, and warm-up.
 const minutes=Math.min(p.minutes,Number(readiness.minutes)||p.minutes);let cost=5;
 const budgeted=[];for(const e of exercises){const per=/min/.test(e[2])?10:e[1]*(1+e[3]/60);if(cost+per<=minutes){budgeted.push(e);cost+=per;}}
 const mission={name:recovery?'Recovery Protocol':`${easy?'Easier ':''}${split==='full'?'Full Body':split==='upper'?'Upper Body':'Lower Body'} • ${p.path}`,focus:recovery?'Recovery protected • no missed-session stacking':`${split} • ${type==='gym'?'weights':'bodyweight'} • ${Math.ceil(cost)} min including warm-up${easy?' • reduced volume':''}`,exercises:budgeted,movements,split,recovery,easy,xp:recovery?150:300,profile:{...p,equipment:type==='gym'?p.equipment:['No Equipment']},trainingPolicy:1};return Movement?Movement.apply(mission,Object.fromEntries(Object.entries(movementProgress).filter(([,v])=>movementAllowed(v.name,p))),history,today):mission;
}
const api={profile,movementAllowed,options,recommendation,plan,catalog};
if(typeof module==='object'&&module.exports)module.exports=api;
root.SystemTraining=api;
if(!root.document)return;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch(_){return fallback}};
const key=s=>'systemMissionTraining:'+systemMissionKey()+':'+s;
const enabled=()=>systemPlayerProfile().profile?.trainingVersion===1;
const initialMission=adaptiveSystemMission,initialEquipment=sessionEquipmentType,initialRender=renderSystemMission,initialLive=renderLiveSet,initialComplete=completeLiveSet,initialStart=startWorkoutMode,initialFinish=finishWorkout;
function gear(){const b=systemPlayerProfile(),p=profile(b),over=sessionEquipmentOverride();if(over)return over;if(!enabled())return initialEquipment();return p.style==='weights'?'gym':p.style==='hybrid'?(new Set(workoutHistory().filter(s=>s.trainingPolicy===1&&!s.recovery).map(s=>s.date)).size%2?'gym':'bodyweight'):'bodyweight';}
sessionEquipmentType=gear;
const legacyMode=missionForMode;missionForMode=function(m,mode=getWorkoutMode()){const result=legacyMode(m,mode);if(m.trainingPolicy===1&&mode==='intense')result.exercises=result.exercises.map((e,i)=>[e[0],e[1],e[2],m.exercises[i][3]]);return result;};
const legacyOverrides=getProgressionOverrides;getProgressionOverrides=function(){return enabled()?{}:legacyOverrides();};
adaptiveSystemMission=function(){
 if(!enabled())return initialMission();
 const frozen=read(key('plan'),null);if(frozen)return frozen;
 // An existing pre-update session keeps its original exercise order and progress.
 if(sessionEquipmentLocked())return initialMission();
 const b=systemPlayerProfile();if(sessionEquipmentOverride()==='gym')b.profile={...b.profile,equipment:['Full Gym']};
 const readiness=read(key('readiness'),{}),schedule=systemTrainingSchedule(),week=adaptiveWeekStatus();if(!schedule.isTrainingDay&&!week.missed.length)readiness.pain='scheduled-rest';const stored=read('systemProgressionMovementV1',{}),progress=Movement?Movement.resolve(stored,workoutHistory(),systemMissionKey()):stored;if(JSON.stringify(stored)!==JSON.stringify(progress))localStorage.setItem('systemProgressionMovementV1',JSON.stringify(progress));
 const m=plan(b,workoutHistory(),systemMissionKey(),gear(),readiness,read(key('swaps'),{}),progress);m.exercises=m.exercises.map(e=>[e[0],e[1],progress[Movement?.find(e[0])?.family]?.trial?e[2]:recommendation(e[0],e[2],workoutHistory(),profile(b).increment,systemMissionKey()).target,e[3]]);return m;
};
function fields(p={},part='all'){const html=`<label>Training style<select name="trainingStyle">${[['bodyweight','Bodyweight'],['weights','Weightlifting'],['hybrid','Hybrid — alternate home and weights']].map(([v,t])=>`<option value="${v}" ${p.trainingStyle===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Minutes per session<input name="minutes" type="number" min="15" max="90" value="${clamp(p.minutes,15,90,30)}"></label><label>Smallest weight increase (lb)<input name="increment" type="number" min="0.5" max="20" step="0.5" value="${clamp(p.increment,.5,20,2.5)}"></label><fieldset><legend>Exclude movements you need to avoid</legend>${['push','pull','squat','hinge','core','cardio','impact'].map(v=>`<label class="settings-check"><input name="avoid" type="checkbox" value="${v}" ${(p.avoid||[]).includes(v)?'checked':''}> ${v}</label>`).join('')}</fieldset><small>Weights are logged in pounds. Dumbbells: weight of ONE dumbbell. Barbell: total including the bar. Warm-up sets are separate from working sets.</small>`;if(part==='style')return html.slice(0,html.indexOf('<label>Minutes'));if(part==='time')return html.slice(html.indexOf('<label>Minutes'),html.indexOf('<fieldset>'));if(part==='avoid')return html.slice(html.indexOf('<fieldset>'),html.indexOf('<small>'));return html;}
api.fields=fields;
api.capture=function(el){const out={trainingVersion:1};if(el.querySelector('[name=trainingStyle]'))out.trainingStyle=el.querySelector('[name=trainingStyle]').value;if(el.querySelector('[name=minutes]'))out.minutes=clamp(el.querySelector('[name=minutes]').value,15,90,30);if(el.querySelector('[name=increment]'))out.increment=clamp(el.querySelector('[name=increment]').value,.5,20,2.5);if(el.querySelector('[name=avoid]'))out.avoid=[...el.querySelectorAll('[name=avoid]:checked')].map(x=>x.value);return out;};
function profileCard(){const host=document.querySelector('#profileSettings .settings-grid')||document.getElementById('profileSettings');if(!host||document.getElementById('trainingProfileForm'))return;
 const build=systemPlayerProfile(),p=build.profile||{},card=document.createElement('article');card.className='dashboard-card training-card';
 card.innerHTML=`<h3>PERSONAL TRAINING PLAN</h3><p>${enabled()?'Update your training preferences.':'Complete this setup to activate personalized training. Your existing rank and history stay saved.'}</p><form id="trainingProfileForm" class="settings-form"><label>Primary goal<select name="path">${['Balanced','Strength','Muscle Building','Fat Loss','Endurance'].map(v=>`<option ${build.path===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Experience<select name="experience">${['Beginner','Returning','Intermediate','Advanced'].map(v=>`<option ${String(p.experience).toLowerCase()===v.toLowerCase()?'selected':''}>${v}</option>`).join('')}</select></label><label>Days each week<input name="days" type="number" min="2" max="6" value="${clamp(p.days,2,6,4)}"></label>${fields(p)}<fieldset><legend>Available equipment</legend>${['Dumbbells','Barbell','Resistance Bands','Cardio Machine','Full Gym'].map(v=>`<label class="settings-check"><input name="gear" type="checkbox" value="${v}" ${(p.equipment||[]).includes(v)?'checked':''}> ${v}</label>`).join('')}</fieldset><button type="submit" class="btn-primary">SAVE TRAINING PLAN</button><p role="status" id="trainingProfileStatus"></p></form>`;
 host.appendChild(card);card.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target,status=card.querySelector('[role=status]');if(sessionEquipmentLocked()){status.textContent='Finish today’s session before changing the training plan.';return;}
 const data=api.capture(f),equipment=[...f.querySelectorAll('[name=gear]:checked')].map(x=>x.value);if(data.trainingStyle!=='bodyweight'&&!equipment.some(x=>['Dumbbells','Barbell','Resistance Bands','Full Gym'].includes(x))){status.textContent='Select your lifting equipment for weightlifting or hybrid training.';return;}
 const b=systemPlayerProfile();b.path=f.elements.path.value;b.profile={...b.profile,...data,equipment:equipment.length?equipment:['No Equipment'],experience:f.elements.experience.value,days:clamp(f.elements.days.value,2,6,4)};localStorage.setItem('systemPlayerBuildV1',JSON.stringify(b));status.textContent='Training plan saved. Your progress is preserved.';renderSystemMission();};
}
renderSystemMission=function(){initialRender();profileCard();if(!enabled()){let setup=document.getElementById('trainingSetupNotice');if(!setup){setup=document.createElement('p');setup.id='trainingSetupNotice';setup.className='training-card';setup.innerHTML='Personalized training is available. <button type="button">SET UP TRAINING</button>';document.getElementById('mission-exercises')?.before(setup);setup.querySelector('button').onclick=()=>{document.querySelector('[data-view=profile]')?.click();document.getElementById('trainingProfileForm')?.scrollIntoView();};}return;}document.getElementById('trainingSetupNotice')?.remove();const m=adaptiveSystemMission(),container=document.getElementById('mission-exercises');if(!container)return;
 if(!m.exercises.length||read(key('readiness'),{}).pain==='yes'){const start=document.getElementById('start-mission-btn');start.disabled=true;start.textContent='REST / UPDATE MOVEMENT LIMITATIONS';}const locked=sessionEquipmentLocked();let brief=document.getElementById('trainingReadiness');if(!brief){brief=document.createElement('div');brief.id='trainingReadiness';brief.className='training-card';container.before(brief);}
 const r=read(key('readiness'),{});brief.innerHTML=`<strong>MISSION READINESS</strong><p>Warm up first. Your home and gym history count together. ${m.recovery?'Recovery is protected today.':m.easy?'Reduced volume today.':'Progress is based on completed working sets.'}</p><div class="training-fields">${[['fatigue','Energy / fatigue'],['soreness','Muscle soreness'],['sleep','Sleep']].map(([v,t])=>`<label>${t}<select data-ready="${v}" ${locked?'disabled':''}>${(v==='sleep'?['normal','poor']:['normal','high']).map(x=>`<option ${r[v]===x?'selected':''}>${x}</option>`).join('')}</select></label>`).join('')}<label>Time today<select data-ready="minutes" ${locked?'disabled':''}>${[15,20,30,45,60,90].map(x=>`<option value="${x}" ${Number(r.minutes||profile(systemPlayerProfile()).minutes)===x?'selected':''}>${x} min</option>`).join('')}</select></label><label>Movement pain<select data-ready="pain" ${locked?'disabled':''}><option value="" ${!r.pain?'selected':''}>No</option><option value="yes" ${r.pain?'selected':''}>Yes — stop affected movement</option></select></label></div>`;
 brief.querySelectorAll('[data-ready]').forEach(el=>el.onchange=()=>{const v=read(key('readiness'),{});v[el.dataset.ready]=el.value;localStorage.setItem(key('readiness'),JSON.stringify(v));renderSystemMission();});
 container.querySelectorAll('.mission-exercise').forEach((card,i)=>{const e=m.exercises[i];if(!e)return;const rec=recommendation(e[0],e[2],workoutHistory(),profile(systemPlayerProfile()).increment,systemMissionKey());const note=document.createElement('p');note.textContent=(rec.weight!=null&&rec.weight>0?`Suggested: ${rec.weight} lb. `:'')+rec.reason;card.appendChild(note);
 renderMovementProgression(card,e,m);
 const pattern=m.movements?.[e[0]],p=profile(systemPlayerProfile());if(sessionEquipmentOverride()==='gym')p.equipment=['Full Gym'];const choices=options(pattern,p,gear()).filter(name=>!p.avoid.includes('impact')||!(/Jog|Burpees/.test(name)&&!/^Elevated|^Step-Back/.test(name)));if(!locked&&choices.length>1){const select=document.createElement('select');select.setAttribute('aria-label','Alternative for '+e[0]);choices.forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;o.selected=name===e[0];select.appendChild(o)});select.onchange=()=>{const swaps=read(key('swaps'),{});swaps[pattern]=select.value;localStorage.setItem(key('swaps'),JSON.stringify(swaps));renderSystemMission();};card.appendChild(select);}});
};

function renderMovementProgression(card,e,m){
 if(!Movement||m.recovery||m.easy)return;
 const today=systemMissionKey(),progress=read('systemProgressionMovementV1',{}),f=Movement.find(e[0]),saved=f&&progress[f.family],notes=m.progressionNotes?.[e[0]],p=profile(systemPlayerProfile());
 if(notes){const label=document.createElement('p');label.className='movement-progression-note';label.textContent=notes;card.append(label);}
 const resetAt=saved?.events?.filter(x=>x.outcome==='stepped-back').at(-1)?.date;const candidate=Movement.next(e[0],workoutHistory().filter(x=>!resetAt||x.date>resetAt),today,Number(state.level)||1);
 const choices=read(key('variationChoices'),{});if(choices[f?.family]===today)return;
 const rollback=saved?.trial?{from:saved.trial.from}:null;
 if(!rollback&&candidate.kind!=='trial')return;
 if(!rollback&&!movementAllowed(candidate.to,p))return;
 if(!rollback&&candidate.to==='Push-Up Burpees'&&!Movement.evidence('Push-Ups',workoutHistory(),today).some(s=>Movement.performance(s,'Push-Ups').ready))return;
 const box=document.createElement('div');box.className='movement-progression';const text=document.createElement('p');text.textContent=rollback?'Trial ready: '+e[0]+'. Reduced volume is planned.':e[0]+' → '+candidate.to+'. '+candidate.reason;box.append(text);
 const accept=document.createElement('button'),keep=document.createElement('button');accept.type=keep.type='button';accept.textContent='TRY NEXT VARIATION';keep.textContent=rollback?'USE PREVIOUS VARIATION':'KEEP CURRENT';accept.hidden=!!rollback;accept.disabled=keep.disabled=sessionEquipmentLocked();
 accept.onclick=()=>{if(sessionEquipmentLocked())return;const all=read('systemProgressionMovementV1',{});all[candidate.family]={name:candidate.to,trial:{from:e[0],started:today},events:all[candidate.family]?.events||[]};localStorage.setItem('systemProgressionMovementV1',JSON.stringify(all));localStorage.removeItem(key('plan'));renderSystemMission();};
 keep.onclick=()=>{if(sessionEquipmentLocked())return;if(rollback){const all=read('systemProgressionMovementV1',{});all[f.family]={...all[f.family],name:rollback.from,trial:null,cooldown:today};localStorage.setItem('systemProgressionMovementV1',JSON.stringify(all));localStorage.removeItem(key('plan'));}const hidden=read(key('variationChoices'),{});hidden[f.family]=today;localStorage.setItem(key('variationChoices'),JSON.stringify(hidden));renderSystemMission();};
 if(!saved?.cooldown||saved.cooldown!==today){box.append(accept,keep);card.append(box);}
}

startWorkoutMode=function(){if(enabled()&&(!adaptiveSystemMission().exercises.length||read(key('readiness'),{}).pain==='yes'))return;if(enabled()&&!sessionEquipmentLocked()){const m=adaptiveSystemMission();localStorage.setItem(key('plan'),JSON.stringify(m));}initialStart();};
renderLiveSet=function(){initialLive();const m=adaptiveSystemMission();if(m.trainingPolicy!==1){document.getElementById('trainingSetFeedback')?.remove();return;}const x=flatSets(m)[liveIndex];if(!x)return;const p=profile(systemPlayerProfile()),rec=recommendation(x.name,x.target,workoutHistory(),p.increment,systemMissionKey()),progress=getMissionProgress();
 const previous=Object.entries(progress).filter(([id,v])=>id.startsWith(x.ei+'-')&&v.done).at(-1)?.[1];
 document.getElementById('liveTarget').textContent=`Target: ${x.target} • ${rec.reason}`;document.getElementById('liveReps').value=parseTargetReps(x.target)||'';document.getElementById('liveWeight').value=previous?.weight??rec.weight??'';
 let feedback=document.getElementById('trainingSetFeedback');if(!feedback){feedback=document.createElement('div');feedback.id='trainingSetFeedback';feedback.className='training-fields';document.querySelector('.live-set-grid').after(feedback);}
 feedback.innerHTML='<label>Good repetitions left?<select id="trainingRir"><option value="">Choose after the set</option><option value="0">0 — no more</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4 or more</option></select></label><label><input id="trainingPain" type="checkbox"> Pain — stop this movement</label><small>Log working sets only. First time? Warm up light and adjust gradually. Dumbbell weight = one dumbbell; barbell weight = total.</small>';
};
completeLiveSet=function(){const m=adaptiveSystemMission();if(m.trainingPolicy!==1){initialComplete();return;}const x=flatSets(m)[liveIndex],reps=Number(document.getElementById('liveReps').value),weight=Number(document.getElementById('liveWeight').value),weighted=/Dumbbell|Barbell|Goblet/.test(x.name),pain=document.getElementById('trainingPain')?.checked;
 if(pain){alert('Stop this movement. Exit the workout and adjust your movement exclusions before your next session.');return;}
 if(!Number.isFinite(reps)||reps<=0||!Number.isFinite(weight)||weight<0||(weighted&&weight<=0)){alert('Enter completed repetitions or seconds and a valid working weight.');return;}
 const rirText=document.getElementById('trainingRir')?.value,p=getMissionProgress();p[x.ei+'-'+x.si]={done:false,reps,weight,rir:rirText===''?null:Number(rirText),pain:false};saveMissionProgress(p);initialComplete();};
// Keep feedback attached to each completed set and freeze actual prescriptions in history.
const initialSave=saveMissionProgress;saveMissionProgress=function(p){const prior=getMissionProgress();Object.keys(p).forEach(id=>{if(prior[id]?.rir!=null&&p[id].rir==null)p[id].rir=prior[id].rir;});initialSave(p);};
finishWorkout=function(){const m=adaptiveSystemMission(),p=getMissionProgress(),mode=getWorkoutMode();initialFinish();if(m.trainingPolicy!==1)return;const h=workoutHistory(),last=h.at(-1);if(last&&last.date===systemMissionKey()){last.trainingPolicy=1;last.split=m.split;last.recovery=m.recovery;last.expectedSets=Object.fromEntries(m.exercises.map(e=>[e[0],e[1]]));last.variationTrials=Object.entries(m.progressionNotes||{}).filter(([,note])=>note.startsWith('NEW VARIATION')).map(([name])=>name);last.sets=flatSets(missionForMode(m,mode)).map((x,i)=>({...last.sets[i],rir:p[x.ei+'-'+x.si]?.rir??null,pain:p[x.ei+'-'+x.si]?.pain===true,formConfirmed:p[x.ei+'-'+x.si]?.formConfirmed===true,prescribedTarget:x.target}));localStorage.setItem('systemWorkoutSessions',JSON.stringify(h));}};
root.addEventListener('DOMContentLoaded',()=>{document.getElementById('completeLiveSet').onclick=completeLiveSet;renderSystemMission();});
})(typeof window==='undefined'?globalThis:window);
