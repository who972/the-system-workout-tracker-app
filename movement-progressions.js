/* Independent movement skills. XP unlocks a trial; confirmed performance earns it. */
(function(root){
'use strict';
const stage=(name,level,target)=>({name,level,target});
const ladders={
 push:[stage('Wall Push-Ups',1,'8-12 reps'),stage('Incline Push-Ups',1,'8-12 reps'),stage('Knee Push-Ups',5,'6-10 reps'),stage('Push-Ups',10,'6-10 reps'),stage('Paused Push-Ups',20,'5-8 reps'),stage('Slow Push-Ups',30,'5-8 reps')],
 squat:[stage('Supported Squats',1,'8-12 reps'),stage('Bodyweight Squats',1,'8-12 reps'),stage('Paused Squats',10,'6-10 reps'),stage('Tempo Squats',20,'6-10 reps')],
 lunge:[stage('Supported Reverse Lunges',1,'6-8/leg'),stage('Reverse Lunges',5,'6-8/leg'),stage('Paused Reverse Lunges',15,'5-8/leg'),stage('Walking Lunges',25,'6-8/leg')],
 pull:[stage('Prone W Raises',1,'8-12 reps'),stage('Prone W Holds',8,'15-20 sec'),stage('Prone W-to-Y Raises',15,'6-10 reps')],
 hinge:[stage('Glute Bridge',1,'8-12 reps'),stage('Paused Glute Bridge',8,'8-12 reps'),stage('Marching Glute Bridge',15,'6-8/leg'),stage('Single-Leg Glute Bridge',25,'5-8/leg')],
 core:[stage('Dead Bug',1,'8-12 reps'),stage('Heel-Tap Dead Bug',8,'6-10/leg'),stage('Long-Lever Dead Bug',18,'6-8/leg')],
 plank:[stage('Elevated Plank',1,'15-20 sec'),stage('Knee Plank',5,'15-20 sec'),stage('Plank',10,'20-30 sec'),stage('Plank Shoulder Taps',20,'6-10 reps')],
 cardio:[stage('March in Place',1,'2 min'),stage('Brisk March in Place',5,'60 sec'),stage('Low-Impact Jog in Place',10,'30 sec'),stage('Jog in Place',20,'30 sec'),stage('Jogging Intervals',30,'45 sec')],
 walk:[stage('Brisk Walk',1,'10 min'),stage('Brisk Walking Intervals',10,'60 sec')],
 burpee:[stage('Elevated Step-Back Burpees',10,'4-6 reps'),stage('Step-Back Burpees',15,'4-6 reps'),stage('Burpees',25,'4-6 reps'),stage('Push-Up Burpees',35,'3-5 reps')],
 bandChest:[stage('Band Chest Press',1,'10-15 reps'),stage('Paused Band Chest Press',15,'8-12 reps'),stage('Tempo Band Chest Press',25,'8-12 reps')],
 bandRow:[stage('Band Row',1,'10-15 reps'),stage('Paused Band Row',15,'8-12 reps'),stage('Tempo Band Row',25,'8-12 reps')],
 bandSquat:[stage('Band Squat',1,'10-15 reps'),stage('Paused Band Squat',15,'8-12 reps'),stage('Tempo Band Squat',25,'8-12 reps')],
 bandBridge:[stage('Band Glute Bridge',1,'10-15 reps'),stage('Paused Band Glute Bridge',15,'8-12 reps'),stage('Tempo Band Glute Bridge',25,'8-12 reps')],
 knees:[stage('Marching Knee Lifts',1,'30 sec'),stage('High Knees',15,'20-30 sec'),stage('High-Knee Intervals',30,'30 sec')],
 climber:[stage('Elevated Mountain Climbers',1,'20-30 sec'),stage('Slow Mountain Climbers',10,'20-30 sec'),stage('Mountain Climbers',20,'20-30 sec')]
};
const weighted=/Dumbbell|Barbell|Goblet|Band |Shoulder Press|Biceps Curls|Triceps Extensions/;
function find(name){for(const [family,items] of Object.entries(ladders)){const index=items.findIndex(x=>x.name===name);if(index>=0)return {family,index,stage:items[index]};}return null;}
function seconds(target){const m=String(target).match(/(\d+)(?:[-–](\d+))?\s*(sec|s\b|min)/i);return m?Number(m[2]||m[1])*(m[3].startsWith('min')?60:1):0;}
function maximum(target){const m=String(target).match(/(\d+)(?:[-–](\d+))?/);return seconds(target)||Number(m?.[2]||m?.[1]||0);}
function evidence(name,history,today,includeTrials=false){return history.filter(s=>(includeTrials||!s.variationTrials?.includes(name))&&s.date<today&&s.trainingPolicy===1&&s.workoutMode==='full'&&!s.recovery&&(s.sets||[]).some(x=>x.name===name)).sort((a,b)=>a.date.localeCompare(b.date));}
function performance(session,name){const sets=session.sets.filter(x=>x.name===name),last=sets.at(-1),expected=session.expectedSets?.[name];
 const complete=Number.isFinite(expected)&&expected>0&&sets.length>=expected;
 const met=complete&&sets.every(x=>Number.isFinite(x.reps)&&x.reps>=maximum(x.prescribedTarget)&&maximum(x.prescribedTarget)>0&&!x.pain);
 return {met,ready:met&&sets.every(x=>x.formConfirmed===true)&&Number.isFinite(last?.rir)&&last.rir>=2,struggled:sets.some(x=>x.pain||x.rir===0||Number.isFinite(x.reps)&&x.reps<maximum(x.prescribedTarget)*.6)};
}
function next(name,history,today,level=1){const f=find(name);if(!f)return {kind:weighted.test(name)?'resistance':'maintain',reason:weighted.test(name)?'Progress through controlled repetitions and working resistance.':'Keep building controlled movement.'};
 const candidate=ladders[f.family][f.index+1];if(!candidate)return {kind:'maintain',reason:'Advanced variation reached. Build control and repeatable performance.'};
 const sessions=evidence(name,history,today),days=[...new Set(sessions.map(s=>s.date))].slice(-2),recent=days.map(date=>sessions.filter(s=>s.date===date).at(-1));
 const age=recent.length?(Date.parse(today+'T12:00:00')-Date.parse(recent.at(-1).date+'T12:00:00'))/86400000:Infinity;
 const earned=recent.length===2&&age<=21&&recent.every(s=>performance(s,name).ready);
 if(!earned)return {kind:'maintain',candidate,reason:'Build two full sessions on separate days at the target, with controlled form and 2+ good reps left.'};
 if(level<candidate.level)return {kind:'locked',candidate,reason:'Performance is ready. The next trial unlocks at level '+candidate.level+'.'};
 return {kind:'trial',family:f.family,from:name,to:candidate.name,target:candidate.target,reason:'Two confirmed sessions met the target with reserve. Try fewer repetitions or shorter intervals at the next variation.'};
}
function resolve(progress,history,today){const out=JSON.parse(JSON.stringify(progress||{}));for(const [family,p] of Object.entries(out)){if(!p.trial)continue;
 const s=evidence(p.name,history,today,true).filter(x=>x.date>=p.trial.started).at(-1);if(!s)continue;
 const result=performance(s,p.name);if(!result.ready&&!result.struggled)continue;
 const passed=result.ready;out[family]={name:passed?p.name:p.trial.from,trial:null,events:[...(p.events||[]),{date:s.date,from:p.trial.from,to:p.name,outcome:passed?'earned':'stepped-back'}].slice(-100),cooldown:passed?null:today};
 }return out;}
function apply(m,progress,history,today){if(m.recovery||m.easy)return m;
 const result={...m,exercises:m.exercises.map(x=>[...x]),movements:{...m.movements},progressionNotes:{}};
 result.exercises=result.exercises.map(e=>{const f=find(e[0]);if(!f)return e;const saved=progress[f.family];if(!saved||!find(saved.name)||find(saved.name).family!==f.family)return e;
 const to=find(saved.name).stage;delete result.movements[e[0]];result.movements[to.name]=m.movements[e[0]]||f.family;
 // Trials reduce exposure. Later sessions build time/reps before another variation.
 const trial=!!saved.trial;let target=to.target,n=Math.min(e[1],trial?1:e[1]);
 if(seconds(target)){n=1;if(!trial){const last=evidence(to.name,history,today,true).at(-1)?.sets.find(x=>x.name===to.name)?.prescribedTarget;const prior=maximum(last);if(prior>0)target=Math.min(prior,/cardio|walk/.test(f.family)?1200:60)+' sec';}}
 result.progressionNotes[to.name]=trial?'NEW VARIATION TRIAL · reduced volume. You can keep the previous variation.':'EARNED VARIATION · '+to.name;
 return [to.name,n,target,Math.max(e[3],trial?60:e[3])];
 });return result;
}
const api={ladders,find,seconds,maximum,evidence,performance,next,resolve,apply,weighted};
if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}root.SystemMovementProgression=api;
if(typeof BUILTIN_EXERCISES!=='undefined')for(const [family,items] of Object.entries(ladders))for(const item of items)if(!BUILTIN_EXERCISES.some(x=>x.name===item.name))BUILTIN_EXERCISES.push({name:item.name,muscle:({push:'Chest',pull:'Back',squat:'Legs',lunge:'Legs',hinge:'Glutes',core:'Core',plank:'Core',cardio:'Cardio',walk:'Cardio',burpee:'Full Body',climber:'Full Body',knees:'Cardio',bandChest:'Chest',bandRow:'Back',bandSquat:'Legs',bandBridge:'Glutes'})[family],equipment:family.startsWith('band')?'Resistance Bands':'Bodyweight',difficulty:item.level>=20?'Advanced':item.level>=8?'Intermediate':'Beginner',stat:['cardio','walk','burpee','climber','knees'].includes(family)?'Conditioning':'Strength',sets:seconds(item.target)?1:2,target:item.target,rest:60});
})(typeof window==='undefined'?globalThis:window);
