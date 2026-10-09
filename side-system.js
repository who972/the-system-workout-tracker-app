/* THE SYSTEM: Side Missions + Full-Screen Boss Battles */
const SIDE_SYSTEM_KEY='systemMission:sideBossV3';
const BUILD_STATS=['Strength','Endurance','Conditioning','Mobility','Consistency','Recovery'];
const TRAINING_PATHS={
 Balanced:{label:'Balanced',desc:'Build every attribute evenly.',boost:[]},
 'Fat Loss':{label:'Fat Loss',desc:'Prioritize conditioning and endurance while preserving strength.',boost:['Conditioning','Endurance']},
 'Muscle Building':{label:'Muscle Building',desc:'Prioritize strength-focused resistance training and recovery.',boost:['Strength','Recovery']},
 Strength:{label:'Strength',desc:'Prioritize force production while maintaining a complete build.',boost:['Strength','Consistency']},
 Endurance:{label:'Endurance',desc:'Prioritize sustained work capacity and conditioning.',boost:['Endurance','Conditioning']}
};
const RANK_STANDARDS={D:{Strength:30,Endurance:30,Conditioning:30,Mobility:25,Consistency:10,Recovery:25},C:{Strength:45,Endurance:45,Conditioning:45,Mobility:40,Consistency:30,Recovery:40},B:{Strength:60,Endurance:60,Conditioning:60,Mobility:50,Consistency:45,Recovery:50},A:{Strength:70,Endurance:70,Conditioning:70,Mobility:60,Consistency:60,Recovery:60},S:{Strength:80,Endurance:80,Conditioning:80,Mobility:70,Consistency:72,Recovery:70},'S+':{Strength:90,Endurance:90,Conditioning:90,Mobility:82,Consistency:84,Recovery:82},Shadow:{Strength:95,Endurance:95,Conditioning:95,Mobility:90,Consistency:92,Recovery:90}};
function loadBuild(){let b={};try{b=JSON.parse(localStorage.getItem('systemPlayerBuildV1')||'{}')}catch(e){}b.path=b.path||'Balanced';b.stats=b.stats||{};BUILD_STATS.forEach(x=>b.stats[x]=Number(b.stats[x]||0));return b}
function saveBuild(b){localStorage.setItem('systemPlayerBuildV1',JSON.stringify(b))}
function setTrainingPath(path){if(!TRAINING_PATHS[path])return;const b=loadBuild();b.path=path;saveBuild(b);if(typeof addSystemMessage==='function')addSystemMessage('TRAINING PATH UPDATED: '+path+'. Your rank, XP and history are unchanged.','level');renderPlayerStatus();renderSideSystem()}
function pathBonus(path,stat){return (TRAINING_PATHS[path]?.boost||[]).includes(stat)?1:0}
function buildDay(){return today()}
function classifyTraining(name){const n=String(name||'').toLowerCase();if(/stretch|mobility|yoga|flex/.test(n))return['Mobility','Recovery'];if(/rest|recovery|deload/.test(n))return['Recovery','Consistency'];if(/fat loss|circuit|hiit|conditioning|metcon/.test(n))return['Conditioning','Endurance'];if(/run|walk|bike|cycling|cardio|swim|endurance|rowing machine|rower/.test(n))return['Endurance','Conditioning'];if(/hypertrophy|strength|bench|squat|deadlift|press|curl|lunge|pull.?up|push.?up|dumbbell row|barbell row|cable row|band row/.test(n))return['Strength','Consistency'];return['Strength','Consistency']}
function awardBuildTraining(name,duration,intensity){
 const b=loadBuild(),day=buildDay();b.daily=b.daily||{};if(b.daily.date!==day)b.daily={date:day,points:0};
 const cap=8,used=Math.max(0,Number(b.daily.points)||0),remaining=Math.max(0,cap-used);if(!remaining)return false;
 const minutes=Math.max(1,Number(duration)||10),credit=Math.max(.25,Math.min(1,Number(intensity)||1));
 const requested=Math.max(1,Math.round(minutes/15*2*credit)),pts=Math.min(remaining,requested),stats=classifyTraining(name);
 let primary=Math.ceil(pts*.7),secondary=pts-primary;
 if(pathBonus(b.path,stats[0])&&secondary>0){primary++;secondary--}else if(pathBonus(b.path,stats[1])&&primary>1){primary--;secondary++}
 b.stats[stats[0]]=Math.min(100,(Number(b.stats[stats[0]])||0)+primary);b.stats[stats[1]]=Math.min(100,(Number(b.stats[stats[1]])||0)+secondary);b.daily.points=used+pts;saveBuild(b);
 if(typeof addSystemMessage==='function')addSystemMessage('BUILD GROWTH: '+stats[0]+' +'+primary+(secondary?' • '+stats[1]+' +'+secondary:'')+' ('+b.daily.points+'/'+cap+' daily points)','quest');
 renderSideSystem();return true
}
function awardBuildMission(id){return false}
function awardSideGrowth(stat,points=1){if(!BUILD_STATS.includes(stat))return false;const b=loadBuild(),day=buildDay();b.daily=b.daily||{};if(b.daily.date!==day)b.daily={date:day,points:0};const cap=8,remaining=Math.max(0,cap-(Number(b.daily.points)||0)),gain=Math.min(remaining,Math.max(1,Number(points)||1));if(!gain)return false;b.stats[stat]=Math.min(100,(Number(b.stats[stat])||0)+gain);b.daily.points=(Number(b.daily.points)||0)+gain;saveBuild(b);if(typeof addSystemMessage==='function')addSystemMessage('GROWTH MISSION: '+stat+' +'+gain+' ('+b.daily.points+'/'+cap+' daily points)','quest');return true}
window.SystemBuild={awardTraining:awardBuildTraining,awardMission:awardBuildMission,awardSideGrowth,getBuild:loadBuild,setPath:setTrainingPath};
function weakestStats(rank){const b=loadBuild(),req=RANK_STANDARDS[rank]||{},missing=BUILD_STATS.map(x=>({stat:x,value:b.stats[x],need:req[x]||0,gap:(req[x]||0)-b.stats[x]})).filter(x=>x.gap>0).sort((a,z)=>z.gap-a.gap);return missing}
function buildEligible(rank){return weakestStats(rank).length===0}
function correctiveMission(rank){const w=weakestStats(rank)[0];if(!w)return null;const map={Strength:'Complete a strength-focused training session.',Endurance:'Complete 20+ minutes of steady endurance work.',Conditioning:'Complete a full-body conditioning circuit.',Mobility:'Complete 15 minutes of mobility work.',Consistency:'Complete your scheduled training sessions this week.',Recovery:'Complete a recovery session and prioritize rest.'};return{stat:w.stat,desc:map[w.stat],gap:w.gap}}
const RANK_REWARDS={
 E:{label:'AWAKENED',desc:'Core daily Side Missions'},
 D:{label:'HUNTER',desc:'Challenge Missions + 10% Side Mission XP',bonus:10},
 C:{label:'VETERAN',desc:'Advanced Missions + 15% Side Mission XP',bonus:15},
 B:{label:'ELITE',desc:'Elite Missions + 20% Side Mission XP',bonus:20},
 A:{label:'MASTER',desc:'Master Missions + 25% Side Mission XP',bonus:25},
 S:{label:'S-RANK',desc:'S-Rank Missions + 35% Side Mission XP',bonus:35},
 'S+':{label:'NATIONAL LEVEL',desc:'National-Level Missions + 45% Side Mission XP',bonus:45},
 Shadow:{label:'SOVEREIGN',desc:'Sovereign Missions + 60% Side Mission XP',bonus:60}
};
const RANK_MISSIONS=[
 {id:'challenge100',rank:'D',title:'Hunter Challenge',desc:'Complete 100 total bodyweight reps.',xp:80},
 {id:'cardio25',rank:'C',title:'Veteran Endurance',desc:'Complete 25 minutes of continuous cardio.',xp:100},
 {id:'eliteCircuit',rank:'B',title:'Elite Circuit',desc:'Complete 4 rounds of a full-body circuit.',xp:125},
 {id:'masterMobility',rank:'A',title:'Master Control',desc:'Complete 20 minutes of mobility plus core work.',xp:150},
 {id:'sRankSession',rank:'S',title:'S-Rank Session',desc:'Complete a challenging 45-minute training session.',xp:200},
 {id:'nationalTrial',rank:'S+',title:'National-Level Mission',desc:'Complete 60 minutes of combined strength and conditioning.',xp:275},
 {id:'sovereignTrial',rank:'Shadow',title:'Sovereign Mission',desc:'Complete your hardest safe full-body session of the week.',xp:350}
];
const SIDE_MISSION_POOLS={
 movement:[
  {id:'steps',title:'Step Hunter',desc:'Reach your daily step goal.',xp:40,ideas:['Take a walk during lunch.','Walk while making a phone call.','Park farther from the entrance.']},
  {id:'stairs',title:'Take the High Road',desc:'Choose the stairs at least twice today.',xp:15,ideas:['Use stairs instead of the elevator.','Skip the escalator.','Add one extra stair trip when practical.']},
  {id:'breaksit',title:'Break the Sit',desc:'Complete 3 short movement breaks.',xp:15,ideas:['Walk for 3–5 minutes.','Stand and move between tasks.','Take a short lap during a break.']}
 ],
 fuel:[
  {id:'hydrate',title:'Hydration Protocol',desc:'Hit your daily water target.',xp:25,ideas:['Carry a refillable bottle.','Drink water with each meal.','Choose water instead of a sugary drink.']},
  {id:'smartfuel',title:'Fuel Selection',desc:'Make one intentional balanced food choice.',xp:20,ideas:['Add a fruit or vegetable.','Choose a lean protein.','Swap a highly processed snack for a balanced option.']},
  {id:'protein',title:'Protein Protocol',desc:'Hit your daily protein target.',xp:25,ideas:['Include protein at breakfast.','Choose a protein-rich snack.','Build a meal around a lean protein source.']}
 ],
 lifestyle:[
  {id:'parkfar',title:'Park & Pursue',desc:'Create one extra walking opportunity today.',xp:10,ideas:['Park farther from the entrance.','Get off one stop earlier when practical.','Take the longer safe walking route.']},
  {id:'smartchoice',title:'Intentional Choice',desc:'Replace one less-helpful habit with a healthier choice.',xp:20,ideas:['Take a short walk instead of scrolling.','Choose water instead of a sugary drink.','Prepare tomorrow instead of leaving it to chance.']},
  {id:'prep',title:'Prepare Tomorrow',desc:'Prepare one thing that makes tomorrow easier.',xp:15,ideas:['Lay out workout clothes.','Prepare a meal or snack.','Fill your water bottle before bed.']}
 ],
 recovery:[
  {id:'mobility',title:'Recovery Protocol',desc:'Complete 10 minutes of stretching or mobility.',xp:30,ideas:['Do a full-body stretch.','Use a short mobility routine.','Stretch while watching TV.']},
  {id:'reset',title:'System Reset',desc:'Take 10 intentional minutes to recover and decompress.',xp:20,ideas:['Take an easy walk.','Do gentle mobility.','Spend 10 quiet minutes away from screens.']},
  {id:'sleepready',title:'Recovery Setup',desc:'Make one choice that supports better sleep tonight.',xp:20,ideas:['Set a consistent bedtime.','Dim screens before bed.','Prepare the room for sleep.']}
 ]
};
const HEALTH_DATA_KEY='systemHealthDataV1';
function loadHealthData(){let h={};try{h=JSON.parse(localStorage.getItem(HEALTH_DATA_KEY)||'{}')}catch(e){}if(h.date!==today())h={date:today(),steps:0,stepGoal:Number(h.stepGoal)||7500,source:'manual'};h.stepGoal=Math.max(1000,Number(h.stepGoal)||7500);h.steps=Math.max(0,Number(h.steps)||0);return h}
function saveHealthData(h){localStorage.setItem(HEALTH_DATA_KEY,JSON.stringify(h))}
function nativeHealthBridge(){return window.AndroidHealthConnect||window.HealthConnectBridge||null}
let healthPermissionGranted=false,healthSyncError='',healthStepRevision=0;
function healthProviderStatus(){const b=nativeHealthBridge(),h=loadHealthData();return{provider:b?'health-connect':'manual',available:!!b,connected:!!b&&healthPermissionGranted,label:h.source==='health-connect'?'Health Connect':'Manual entry',futureProvider:'Health Connect'}}
async function syncHealthSteps(){
 const b=nativeHealthBridge();if(!b||typeof b.getTodaySteps!=='function')return false;
 const date=today(),revision=healthStepRevision;healthSyncError='';
 try{
  const raw=await b.getTodaySteps(),parsed=typeof raw==='string'?JSON.parse(raw):raw;
  if(parsed==null||parsed.error)throw new Error(parsed?.error||'invalid-step-result');
  const value=typeof parsed==='object'?parsed.steps:parsed;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('invalid-step-result');
  if(today()!==date||(parsed.date&&parsed.date!==date)||revision!==healthStepRevision)throw new Error('stale-step-result');
  const h=loadHealthData();h.steps=value;h.source='health-connect';saveHealthData(h);healthPermissionGranted=true;healthStepRevision++;renderSideSystem();return true;
 }catch(e){healthSyncError=e.message;healthPermissionGranted=false;return false}
}
async function requestHealthConnect(){const b=nativeHealthBridge();if(!b||typeof b.requestStepPermission!=='function')return false;healthSyncError='';try{const ok=await b.requestStepPermission();healthPermissionGranted=ok===true||ok==='true'||ok===1||ok==='1';if(!healthPermissionGranted)healthSyncError='permission-required';return healthPermissionGranted}catch(e){healthSyncError=e.message;healthPermissionGranted=false;return false}}
function setManualSteps(value){healthStepRevision++;const h=loadHealthData();h.steps=Math.max(0,Math.floor(Number(value)||0));h.source='manual';saveHealthData(h);renderSideSystem()}
function setStepGoal(value){const h=loadHealthData();h.stepGoal=Math.max(1000,Math.floor(Number(value)||7500));saveHealthData(h);renderSideSystem()}
window.SystemHealthProvider={getStatus:healthProviderStatus,getToday:loadHealthData,setSteps:setManualSteps,setStepGoal,sync:syncHealthSteps,requestAccess:requestHealthConnect};
function dailyPick(pool,key){const seed=Number(today().replace(/-/g,''))+[...key].reduce((n,x)=>n+x.charCodeAt(0),0);return pool[seed%pool.length]}
function growthMission(){const s=loadSideSystem(),b=loadBuild(),next=nextPromotion(s),rank=next?.rank,req=rank?RANK_STANDARDS[rank]||{}:{},stats=b.stats||{};let target=BUILD_STATS.map(x=>({stat:x,gap:Math.max(0,(req[x]||0)-(stats[x]||0))})).sort((a,z)=>z.gap-a.gap)[0]?.stat||'Consistency';
 const map={
 Strength:{title:'Build the Foundation',desc:'Complete 2 short strength breaks today.',xp:25,ideas:['10 chair or bodyweight squats.','5–10 incline push-ups.','10 glute bridges.']},
 Endurance:{title:'Extra Movement',desc:'Complete 10 minutes of additional purposeful movement.',xp:25,ideas:['Take a 10-minute walk.','Walk during a phone call.','Use a cardio machine for 10 minutes if available.']},
 Conditioning:{title:'Raise the Engine',desc:'Complete 5–10 minutes of brisk movement.',xp:25,ideas:['Brisk walk.','March in place.','Short low-impact circuit.']},
 Mobility:{title:'Restore Range',desc:'Complete 10 minutes of mobility work.',xp:20,ideas:['Hip and ankle mobility.','Shoulder mobility.','Gentle full-body stretching.']},
 Consistency:{title:'Keep the Promise',desc:'Complete one planned healthy action at the time you intended.',xp:20,ideas:['Take the walk you scheduled.','Prepare the meal you planned.','Start your workout at the planned time.']},
 Recovery:{title:'Recovery Investment',desc:'Complete 10 minutes of intentional recovery.',xp:20,ideas:['Gentle stretching.','Easy recovery walk.','Quiet screen-free wind-down.']}
 };
 return {id:'growth',tag:'GROWTH MISSION',stat:target,...map[target]};
}
function dailySideMissions(){return [
 {...dailyPick(SIDE_MISSION_POOLS.movement,'movement'),tag:'MOVEMENT'},
 {...dailyPick(SIDE_MISSION_POOLS.fuel,'fuel'),tag:'FUEL'},
 {...dailyPick(SIDE_MISSION_POOLS.lifestyle,'lifestyle'),tag:'LIFESTYLE'},
 {...dailyPick(SIDE_MISSION_POOLS.recovery,'recovery'),tag:'RECOVERY'},
 growthMission()
]}
function task(text,damage,attack,seconds=0){return{text,damage,attack,seconds}}
function variants(sq,pu,lu,pl,cardio){return[
{name:'Strength Trial',focus:'Strength / Core',time:(cardio+10)+'–'+(cardio+18)+' min',tasks:[task(sq+' squats',30,'POWER STRIKE'),task(pu+' push-ups',30,'POWER STRIKE'),task(lu+' alternating lunges',15,'LEG BREAK'),task(pl+'-second plank',15,'CORE BREAK',pl),task(cardio+'-minute cardio',10,'ENDURANCE HIT',cardio*60)]},
{name:'Endurance Trial',focus:'Endurance / Conditioning',time:(cardio+12)+'–'+(cardio+20)+' min',tasks:[task(Math.max(10,sq-5)+' squats',10,'POWER HIT'),task(Math.max(5,pu-3)+' push-ups',10,'POWER HIT'),task((lu+6)+' step-ups',20,'ENDURANCE STRIKE'),task(Math.round(pl*1.15)+'-second plank',20,'CORE BREAK',Math.round(pl*1.15)),task((cardio+3)+'-minute cardio',40,'ENDURANCE CRITICAL',(cardio+3)*60)]},
{name:'Full Body Trial',focus:'Full Body / Control',time:(cardio+10)+'–'+(cardio+18)+' min',tasks:[task(sq+' chair or bodyweight squats',20,'STRIKE'),task(pu+' incline or standard push-ups',20,'STRIKE'),task(lu+' reverse lunges',20,'STRIKE'),task(Math.max(10,Math.round(sq/2))+' glute bridges',20,'STRIKE'),task(cardio+'-minute cardio',20,'STRIKE',cardio*60)]},
{name:'System Circuit',focus:'Circuit / Conditioning',time:(cardio+8)+'–'+(cardio+16)+' min',tasks:[task('3 rounds: '+Math.ceil(sq/3)+' squats',15,'COMBO HIT'),task('3 rounds: '+Math.ceil(pu/3)+' push-ups',20,'COMBO HIT'),task('3 rounds: '+Math.ceil(lu/3)+' alternating lunges',25,'HEAVY COMBO'),task('3 rounds: '+Math.ceil(pl/3)+'-second plank',15,'CORE BREAK'),task(Math.max(5,cardio-5)+'-minute cardio finisher',25,'FINISHER',Math.max(5,cardio-5)*60)]}
]}
const BOSS_STAGES=[
{rank:'D',level:10,title:'D-Rank Promotion',reward:250,variants:variants(20,10,20,30,10)},
{rank:'C',level:20,title:'C-Rank Promotion',reward:400,variants:variants(30,15,24,45,12)},
{rank:'B',level:30,title:'B-Rank Promotion',reward:600,variants:variants(40,20,30,60,15)},
{rank:'A',level:40,title:'A-Rank Promotion',reward:850,variants:variants(50,25,36,75,18)},
{rank:'S',level:50,title:'S-Rank Promotion',reward:1200,variants:variants(60,30,40,90,20)},
{rank:'S+',level:70,title:'National-Level Trial',reward:1600,variants:variants(70,35,50,120,25)},
{rank:'Shadow',level:90,title:'Sovereign Trial',reward:2500,variants:variants(80,40,60,120,30)}
];
let bossClock=null,bossTimer=null,battleStartedAt=0;
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function loadSideSystem(){let s={};try{s=JSON.parse(localStorage.getItem(SIDE_SYSTEM_KEY)||'{}')}catch(e){}if(s.date!==today())s={...s,date:today(),completed:[],adaptiveDone:[],sideBonus3:false,sideBonus5:false};s.completed=s.completed||[];s.adaptiveDone=s.adaptiveDone||[];s.sideBonus3=!!s.sideBonus3;s.sideBonus5=!!s.sideBonus5;s.boss=s.boss||{};s.rankMissionClaims=s.rankMissionClaims||{};return s}
function saveSideSystem(s){localStorage.setItem(SIDE_SYSTEM_KEY,JSON.stringify(s))}
function currentClass(s){let c='E';for(const b of BOSS_STAGES)if(s.boss[b.rank]?.passed)c=b.rank;return c}
function rankIndex(rank){return ['E','D','C','B','A','S','S+','Shadow'].indexOf(rank)}
function unlockedMissions(s){
 const daily=dailySideMissions(),cur=currentClass(s),ci=rankIndex(cur);
 const rankMission=RANK_MISSIONS.filter(m=>rankIndex(m.rank)<=ci).slice(-1)[0];
 return rankMission?[...daily,{...rankMission,category:'rank',ideas:['Complete this challenge through your logged training.'],rankMission:true}]:daily
}
function rewardXp(base,s){const r=RANK_REWARDS[currentClass(s)]||RANK_REWARDS.E;return Math.round(base*(1+(r.bonus||0)/100))}
function bossIndex(rank){return BOSS_STAGES.findIndex(b=>b.rank===rank)}
function eligible(b,s){const i=bossIndex(b.rank),level=typeof state!=='undefined'?state.level:1;return level>=b.level&&(i===0||!!s.boss[BOSS_STAGES[i-1].rank]?.passed)&&buildEligible(b.rank)}
function chooseVariant(b,e){let n=Math.floor(Math.random()*b.variants.length);if(b.variants.length>1&&n===e.lastVariant)n=(n+1+Math.floor(Math.random()*(b.variants.length-1)))%b.variants.length;return n}
function shuffle(n){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function ensureAttempt(b,s){const e=s.boss[b.rank]||{attempts:0,history:[]};if(e.activeVariant==null){e.activeVariant=chooseVariant(b,e);e.order=shuffle(b.variants[e.activeVariant].tasks.length);e.current=0;e.damage=0;e.checks=[];e.startedAt=new Date().toISOString();e.timerObjective=null;e.timerEndsAt=null;e.timerComplete=false}e.history=e.history||[];s.boss[b.rank]=e;saveSideSystem(s);return e}

function ensureRankPath(){let el=document.getElementById('rankPathPanel');if(el)return el;const root=document.getElementById('bossStageSystem')||document.getElementById('sideMissionSystem');if(!root)return null;el=document.createElement('section');el.id='rankPathPanel';el.className='rank-path-panel';const list=root.querySelector('#bossStageList');root.insertBefore(el,list||root.firstChild);return el}
function renderRankPath(){const el=ensureRankPath();if(!el)return;const s=loadSideSystem(),cur=currentClass(s),ci=rankIndex(cur),level=typeof state!=='undefined'?state.level:1;
 const stages=[{rank:'E',level:1,title:'Awakened',boss:'No promotion trial',reward:RANK_REWARDS.E},...BOSS_STAGES.map(b=>({rank:b.rank,level:b.level,title:b.title,boss:b.variants.length+' possible Boss Trials',reward:RANK_REWARDS[b.rank]}))];
 el.innerHTML='<div class="rank-path-head"><div><span class="side-tag">PLAYER PROGRESSION</span><h2>RANK PATH</h2><p>Level '+level+' • Current Rank: '+cur+'-CLASS</p></div><button id="rankPathToggle" type="button">VIEW PATH</button></div><div id="rankPathTrack" class="rank-path-track">'+stages.map((x,i)=>{const cleared=i<ci||(i===0&&ci>0),current=i===ci,locked=i>ci,boss=BOSS_STAGES.find(b=>b.rank===x.rank),entry=boss?s.boss[x.rank]:null,status=cleared?'CLEARED':current?'CURRENT':'LOCKED';return '<article class="rank-node '+(cleared?'cleared ':current?'current ':'locked ')+'"><div class="rank-node-line"></div><div class="rank-emblem">'+x.rank+'</div><div class="rank-node-copy"><span class="side-tag">'+status+'</span><h3>'+x.title+'</h3><p>Level '+x.level+' • '+x.boss+'</p><p>'+x.reward.desc+'</p>'+(entry&&entry.attempts?'<small>'+entry.attempts+' Boss attempt'+(entry.attempts===1?'':'s')+'</small>':'')+'</div></article>'}).join('')+'</div>';
 const btn=document.getElementById('rankPathToggle'),track=document.getElementById('rankPathTrack');btn.onclick=()=>{const open=track.classList.toggle('open');btn.textContent=open?'HIDE PATH':'VIEW PATH'}
}

function renderAdaptiveMissions(){const el=document.getElementById('adaptiveMissionPanel');if(el)el.remove()}
const WEEKLY_BOSS_CLASSES={E:{type:'GATE BOSS',name:'IRONHIDE BRUTE',hp:6000,xp:300},D:{type:'ALPHA BEAST',name:'FANG OF THE DEEP',hp:12000,xp:450},C:{type:'NAMED BOSS',name:'THE IRON DEVOURER',hp:24000,xp:650},B:{type:'HIGH-TIER BOSS',name:'VOID WARDEN',hp:42000,xp:900},A:{type:'LAIR MASTER',name:'THE ABYSS SENTINEL',hp:70000,xp:1200},S:{type:'CATASTROPHE-CLASS',name:'WORLD EATER',hp:110000,xp:1600},'S+':{type:'SOVEREIGN-CLASS',name:'THE LAST TYRANT',hp:175000,xp:2100},Shadow:{type:'APEX ENCOUNTER',name:'THE ECLIPSE KING',hp:250000,xp:3000}};
function weekKey(){const d=new Date(),day=(d.getDay()+6)%7,m=new Date(d);m.setDate(d.getDate()-day);return m.toISOString().slice(0,10)}
function weeklyGateState(s){const rank=currentClass(s),def=WEEKLY_BOSS_CLASSES[rank]||WEEKLY_BOSS_CLASSES.E,key=weekKey();s.weeklyGate=s.weeklyGate||{};if(s.weeklyGate.key!==key||s.weeklyGate.rank!==rank){if(s.weeklyGate.key)s.gateHistory=[...(s.gateHistory||[]),{...s.weeklyGate,boss:(WEEKLY_BOSS_CLASSES[s.weeklyGate.rank]||{}).name||'UNKNOWN BOSS'}].slice(-52);s.weeklyGate={key,rank,damage:0,defeated:false,claimed:false,missionHits:{}}}return{g:s.weeklyGate,rank,def}}
function claimWeeklyGateVictory(s,w){
 const g=w.g;if(!g.defeated||g.claimed)return false;g.claimed=true;g.clearedAt=new Date().toISOString();s.gateVictories=s.gateVictories||[];s.gateVictories.unshift({week:g.key,rank:w.rank,boss:w.def.name,damage:g.damage,xp:w.def.xp,clearedAt:g.clearedAt});s.gateVictories=s.gateVictories.slice(0,100);saveSideSystem(s);
 if(typeof addXp==='function')addXp(w.def.xp,'boss',{suppressReward:true});
 if(typeof queueReward==='function')queueReward({type:'boss',title:'GATE CLEARED',detail:w.def.name+' • +'+w.def.xp+' XP',amount:w.def.xp,intensity:'major',source:'boss'});
 if(typeof addSystemMessage==='function')addSystemMessage('Boss defeated: '+w.def.name+' • +'+w.def.xp+' XP','achievement');
 return true
}
function applyMissionDamageToWeeklyGate(performance,prs=[]){
 const s=loadSideSystem(),w=weeklyGateState(s),g=w.g;if(g.defeated)return{damage:0,critical:false,defeated:true,hp:0};
 const key=(typeof systemMissionKey==='function'?systemMissionKey():today())+':'+(performance?.mode||'full');
 g.missionHits=g.missionHits||{};if(g.missionHits[key])return g.missionHits[key];
 const score=Math.max(0,Math.min(100,Number(performance?.score)||0)),critical=(prs?.length||0)>0;
 const rankScale={E:8,D:14,C:25,B:42,A:70,S:110,'S+':175,Shadow:250}[w.rank]||8;
 const modeScale=performance?.mode==='full'?1:performance?.mode==='intense'?.8:.55;
 const streakBonus=1+Math.min(7,Number(typeof state!=='undefined'?state.currentStreak||0:0))*.02;
 const critBonus=critical?1.2:1;
 const damage=Math.max(1,Math.round(score*rankScale*modeScale*streakBonus*critBonus));
 g.damage=Math.min(w.def.hp,(Number(g.damage)||0)+damage);g.defeated=g.damage>=w.def.hp;
 const hit={damage,critical,defeated:g.defeated,hp:Math.max(0,w.def.hp-g.damage),maxHp:w.def.hp,boss:w.def.name,rank:w.rank,score};g.missionHits[key]=hit;saveSideSystem(s);
 if(typeof queueReward==='function')queueReward({type:'boss',title:critical?'CRITICAL HIT':'BOSS DAMAGE',detail:w.def.name+' • '+damage.toLocaleString()+' DAMAGE',amount:0,intensity:g.defeated?'major':'mission',source:'boss'});
 if(g.defeated){claimWeeklyGateVictory(s,w);if(window.SystemProgression?.bossUnlocked)window.SystemProgression.bossUnlocked(w.def.name+' DEFEATED')}
 setTimeout(()=>{try{renderBossCommand()}catch(e){}},100);
 return hit
}
function weeklyGateDamage(s){const w=weeklyGateState(s),daily=dailySideMissions().map(x=>x.id),side=s.completed.filter(x=>daily.includes(x)).length,quests=(typeof state!=='undefined'&&state.dailyQuests?state.dailyQuests.filter(q=>q.completed).length:0),streak=Number(typeof state!=='undefined'?state.currentStreak||0:0);return Math.min(w.def.hp,quests*900+side*450+Math.min(7,streak)*180)}
function renderBossCommand(){
 const host=document.getElementById('bossStageSystem');if(!host)return;
 let panel=document.getElementById('weeklyGatePanel');
 if(!panel){panel=document.createElement('section');panel.id='weeklyGatePanel';panel.className='weekly-gate-panel';const list=host.querySelector('#bossStageList');host.insertBefore(panel,list||host.firstChild)}
 panel.innerHTML='<div class="gate-tabs"><button class="active" type="button">WEEKLY GATE</button><button type="button" data-jump-rank>RANK TRIAL</button></div><div class="gate-threat"><div><span class="side-tag">GATE BOSS // E-RANK GATE</span><h2>IRONHIDE BRUTE</h2><p>HOSTILE ENTITY DETECTED // WEEKLY ENCOUNTER ACTIVE</p></div><div class="gate-rank">E</div></div><div class="gate-hp-head"><span>BOSS HP</span><strong>6,000 / 6,000</strong></div><div class="gate-hp"><i style="width:100%"></i></div><div class="gate-grid"><article><span class="side-tag">BOSS INTEL</span><p><b>Primary Strength:</b> Baseline pending</p><p><b>Weakness:</b> Baseline pending</p><p><b>System Strategy:</b> Complete training to generate combat strategy.</p></article><article><span class="side-tag">COMBAT CONTRIBUTION</span><p>Main objectives cleared: <b>0</b></p><p>Side Missions: <b>0/5</b></p><p>Damage dealt: <b>0</b></p></article><article><span class="side-tag">REWARDS</span><p><b>Gate Clear XP</b></p><p>Boss victory record</p><p>Rank progression credit</p></article></div><div class="gate-phase"><span>PHASE I</span><b>ARMOR INTACT</b></div><div class="rank-trial-preview"><span class="side-tag">NEXT RANK TRIAL</span><strong>D-CLASS PROMOTION</strong><small>LOCKED // COMPLETE PROMOTION REQUIREMENTS</small></div>';
 try{
  const ss=loadSideSystem();
  const rank=currentClass(ss)||'E';
  const def=WEEKLY_BOSS_CLASSES[rank]||WEEKLY_BOSS_CLASSES.E;
  const key=weekKey();
  ss.weeklyGate=ss.weeklyGate||{};
  if(ss.weeklyGate.key!==key||ss.weeklyGate.rank!==rank)ss.weeklyGate={key:key,rank:rank,damage:0,defeated:false,claimed:false};
  const gate=ss.weeklyGate;
  let sideDone=0;
  try{const daily=dailySideMissions();const ids=Array.isArray(daily)?daily.map(m=>m.id):[];sideDone=(ss.completed||[]).filter(id=>ids.includes(id)).length}catch(e){}
  const quests=(typeof state!=='undefined'&&Array.isArray(state.dailyQuests))?state.dailyQuests.filter(q=>q&&q.completed).length:0;
  const streak=(typeof state!=='undefined')?(Number(state.currentStreak)||0):0;
  const damage=Math.max(0,quests*900+sideDone*450+Math.min(7,streak)*180);
  gate.damage=Math.min(def.hp,Math.max(Number(gate.damage)||0,damage));gate.defeated=gate.damage>=def.hp;saveSideSystem(ss);
  const hp=Math.max(0,def.hp-gate.damage),pct=Math.max(0,Math.min(100,Math.round(hp/def.hp*100)));
  let intel={strength:'Baseline pending',weak:'Baseline pending',directive:'Complete training to generate combat strategy.'};
  try{if(typeof systemIntelligence==='function'){const x=systemIntelligence();if(x)intel=Object.assign(intel,x)}}catch(e){}
  let next=null,ready=false;try{next=typeof nextPromotion==='function'?nextPromotion(ss):null;if(next)ready=eligible(next,ss)}catch(e){}
  panel.querySelector('.gate-threat .side-tag').textContent=def.type+' // '+rank+'-RANK GATE';
  panel.querySelector('.gate-threat h2').textContent=def.name;
  panel.querySelector('.gate-threat p').textContent=gate.defeated?'GATE CLEARED // BOSS DEFEATED':'HOSTILE ENTITY DETECTED // WEEKLY ENCOUNTER ACTIVE';
  panel.querySelector('.gate-rank').textContent=rank;
  panel.querySelector('.gate-hp-head strong').textContent=hp.toLocaleString()+' / '+def.hp.toLocaleString();
  panel.querySelector('.gate-hp i').style.width=pct+'%';
  const cards=panel.querySelectorAll('.gate-grid article');
  cards[0].innerHTML='<span class="side-tag">BOSS INTEL</span><p><b>Primary Strength:</b> '+intel.strength+'</p><p><b>Weakness:</b> '+intel.weak+'</p><p><b>System Strategy:</b> '+intel.directive+'</p>';
  cards[1].innerHTML='<span class="side-tag">COMBAT CONTRIBUTION</span><p>Main objectives cleared: <b>'+quests+'</b></p><p>Side Missions: <b>'+sideDone+'/5</b></p><p>Damage dealt: <b>'+gate.damage.toLocaleString()+'</b></p>';cards[2].innerHTML='<span class="side-tag">REWARDS</span><p><b>+'+def.xp.toLocaleString()+' XP</b> Gate Clear</p><p>Boss victory record</p><p>'+(gate.claimed?'REWARD CLAIMED':'DEFEAT BOSS TO CLAIM')+'</p>';
  panel.querySelector('.gate-phase span').textContent='PHASE '+(pct>66?'I':pct>33?'II':'III');
  panel.querySelector('.gate-phase b').textContent=pct>66?'ARMOR INTACT':pct>33?'DEFENSE BREAKING':'FINAL PHASE';
  if(next){panel.querySelector('.rank-trial-preview strong').textContent=next.rank+'-CLASS PROMOTION';panel.querySelector('.rank-trial-preview small').textContent=ready?'QUALIFIED // TRIAL READY':'LOCKED // COMPLETE PROMOTION REQUIREMENTS'}
 }catch(err){console.error('Weekly Gate telemetry update failed',err)}
 panel.querySelector('[data-jump-rank]')?.addEventListener('click',()=>host.querySelector('#bossStageList')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function renderSideSystem(){renderPlayerStatus();renderBossCommand();renderRankPath();const root=document.getElementById('sideMissionSystem');if(!root)return;const s=loadSideSystem(),missions=document.getElementById('sideMissionList');
renderAdaptiveMissions();const available=unlockedMissions(s),dailyIds=dailySideMissions().map(x=>x.id),count=s.completed.filter(id=>dailyIds.includes(id)).length;missions.innerHTML='<div class="side-board-progress"><strong>DAILY SIDE MISSIONS • '+count+'/5</strong><span>3/5: +50 XP • 5/5: +100 XP</span></div>'+available.map(m=>{const h=m.id==='steps'?loadHealthData():null,hs=h?healthProviderStatus():null,stepUI=h?'<div class="step-provider"><div class="step-progress"><strong>'+h.steps.toLocaleString()+' / '+h.stepGoal.toLocaleString()+' STEPS</strong><div class="step-track"><i style="width:'+Math.min(100,Math.round(h.steps/h.stepGoal*100))+'%"></i></div></div>'+(hs.available?'<button type="button" data-health-sync>SYNC HEALTH CONNECT</button>':'')+'<label>Today’s steps (manual) <input data-step-input type="number" min="0" step="100" value="'+h.steps+'"></label>'+'<label>Goal <input data-step-goal type="number" min="1000" step="500" value="'+h.stepGoal+'"></label><small>Source: '+hs.label+(hs.available?' • Tap sync to allow Steps access':' • Health Connect sync is available in the Android app')+'</small></div>':'';const claimed=s.completed.includes(m.id)||(m.rankMission&&!!s.rankMissionClaims[m.id]);return '<article class="side-card '+(claimed?'is-done':'')+'"><div><span class="side-tag">'+(m.tag||'SIDE MISSION')+(m.stat?' • '+m.stat.toUpperCase():'')+'</span><h3>'+m.title+'</h3><p>'+m.desc+'</p>'+stepUI+'<details class="side-ideas"><summary>IDEAS</summary><ul>'+(m.ideas||[]).map(x=>'<li>'+x+'</li>').join('')+'</ul></details></div><div class="side-reward">+'+m.xp+' XP</div><button data-side="'+m.id+'" '+(claimed?'disabled':'')+'>'+(claimed?'COMPLETE':'CLAIM COMPLETE')+'</button></article>'}).join('');
missions.querySelectorAll('[data-side]').forEach(x=>x.onclick=()=>completeSideMission(x.dataset.side));
const stepInput=missions.querySelector('[data-step-input]'),stepGoal=missions.querySelector('[data-step-goal]');
if(stepInput)stepInput.onchange=()=>setManualSteps(stepInput.value);
if(stepGoal)stepGoal.onchange=()=>setStepGoal(stepGoal.value);const healthSync=missions.querySelector('[data-health-sync]');if(healthSync)healthSync.onclick=async()=>{healthSync.disabled=true;healthSync.textContent='SYNCING…';const ok=await requestHealthConnect()&&await syncHealthSteps();if(!ok){healthSync.disabled=false;healthSync.textContent='SYNC HEALTH CONNECT';const reason=healthSyncError==='provider-update-required'?'Install or update Health Connect from Google Play, then try again.':healthSyncError==='unavailable'?'Health Connect is unavailable on this device.':healthSyncError==='permission-required'?'Allow Steps access in Health Connect settings, then try again.':'Health Connect could not sync. Try again or check Steps access in Health Connect settings.';alert('SYSTEM: '+reason+' Your saved steps are unchanged. You can still enter steps manually.')}};const cls=currentClass(s),reward=RANK_REWARDS[cls]||RANK_REWARDS.E;document.getElementById('currentRankClass').textContent=cls+'-CLASS • '+reward.label;
const wrap=document.getElementById('bossStageList');wrap.innerHTML=BOSS_STAGES.map(b=>{const e=s.boss[b.rank]||{attempts:0,history:[]},best=(e.history||[]).reduce((m,x)=>Math.max(m,x.completed||0),0);
if(e.passed)return '<article class="boss-card boss-passed"><span class="side-tag">BOSS DEFEATED</span><h3>'+b.title+'</h3><p>Promotion achieved • +'+b.reward+' XP</p><button disabled>'+b.rank+'-CLASS UNLOCKED</button></article>';
if(!eligible(b,s)){const level=typeof state!=='undefined'?state.level:1,cm=correctiveMission(b.rank),missing=weakestStats(b.rank),i=bossIndex(b.rank),prev=i>0?BOSS_STAGES[i-1]:null,prevMet=!prev||!!s.boss[prev.rank]?.passed,levelMet=level>=b.level,buildMet=!missing.length,locks=[];if(!levelMet)locks.push('Reach Level '+b.level);if(!prevMet)locks.push('Earn '+prev.rank+'-Class promotion');if(!buildMet)locks.push('Stabilize all 6 build attributes');return '<article class="boss-card boss-locked"><span class="side-tag">SYSTEM ANALYSIS</span><h3>'+b.title+'</h3><p>Promotion Trial locked. Complete every requirement below.</p><div class="boss-requirements"><span>'+(levelMet?'✓':'○')+' LEVEL '+b.level+'</span>'+(prev?'<span>'+(prevMet?'✓':'○')+' '+prev.rank+'-CLASS PROMOTION</span>':'')+'<span>'+(buildMet?'✓':'○')+' BALANCED BUILD</span></div>'+(missing.length?'<div class="build-warning"><strong>UNDERDEVELOPED: '+missing.map(x=>x.stat+' '+Math.round(x.value)+'/'+x.need).join(' • ')+'</strong>'+(cm?'<p>SYSTEM DIRECTIVE: '+cm.desc+'</p>':'')+'</div>':'')+'<button disabled>'+locks[0].toUpperCase()+'</button></article>'}
return '<article class="boss-card boss-ready"><span class="side-tag">BOSS INTEL</span><h3>'+b.title+'</h3><p>Level '+b.level+' • +'+b.reward+' XP • '+b.variants.length+' possible trials</p><p>Attempts: '+(e.attempts||0)+' • Best: '+best+'/5</p><p>Objectives and order are classified until battle begins.</p><button data-start="'+b.rank+'">'+(e.activeVariant!=null?'RESUME BOSS BATTLE':'BEGIN RANK TRIAL')+'</button></article>'}).join('');
wrap.querySelectorAll('[data-start]').forEach(x=>x.onclick=()=>startBoss(x.dataset.start))}
function todayWorkoutEvidence(){const day=today(),sessions=typeof workoutHistory==='function'?workoutHistory():[];return sessions.filter(x=>x.date===day)}
function sessionMinutes(x){return Math.max(0,Number(x?.seconds||0)/60)}
function sessionText(x){return [x?.mission,...(x?.sets||[]).map(s=>s?.name)].filter(Boolean).join(' ').toLowerCase()}
function sessionReps(x,re){return (x?.sets||[]).reduce((n,s)=>n+(re.test(String(s?.name||'').toLowerCase())?Math.max(0,Number(s?.reps)||0):0),0)}
function sessionRounds(x){const sets=x?.sets||[];if(!sets.length)return 0;const names=[...new Set(sets.map(s=>String(s?.name||'').toLowerCase()).filter(Boolean))];if(names.length<3)return 0;return Math.min(...names.map(n=>sets.filter(s=>String(s?.name||'').toLowerCase()===n).length))}
function missionEvidence(id,evidence){
 const mins=evidence.reduce((n,x)=>n+sessionMinutes(x),0),text=evidence.map(sessionText).join(' '),has=p=>p.test(text),
 core=evidence.reduce((n,x)=>n+sessionReps(x,/plank|crunch|sit.?up|dead bug|core|mountain climber/),0),
 body=evidence.reduce((n,x)=>n+sessionReps(x,/push|squat|lunge|bridge|plank|mountain climber|burpee|sit.?up|crunch/),0);
 const checks={
  mobility:()=>mins>=10&&has(/mobility|stretch|yoga|flex/),
  challenge100:()=>body>=100,
  cardio25:()=>mins>=25&&has(/cardio|walk|run|bike|rower|rowing machine|swim|endurance/),
  eliteCircuit:()=>evidence.some(x=>sessionRounds(x)>=4)&&has(/circuit|full body|squat|push|lunge|row|plank|burpee/),
  masterMobility:()=>mins>=20&&has(/mobility|stretch|yoga|flex/)&&has(/plank|core|dead bug|crunch|sit.?up/),
  sRankSession:()=>evidence.some(x=>sessionMinutes(x)>=45),
  nationalTrial:()=>mins>=60&&has(/strength|push|press|squat|lunge|row|deadlift/)&&has(/conditioning|cardio|walk|run|bike|hiit|circuit/),
  sovereignTrial:()=>evidence.some(x=>sessionMinutes(x)>=45&&/full body|strength|conditioning|circuit/.test(sessionText(x)))
 };
 return checks[id]?checks[id]():false
}
function completeSideMission(id){const evidence=todayWorkoutEvidence(),s=loadSideSystem(),m=unlockedMissions(s).find(x=>x.id===id);if(!m||s.completed.includes(id)||m.rankMission&&s.rankMissionClaims[m.id])return;
 if(id==='steps'){const h=loadHealthData();if(h.steps<h.stepGoal){alert('SYSTEM: Step Hunter requires '+h.stepGoal.toLocaleString()+' steps. Current progress: '+h.steps.toLocaleString()+'.');return;}}
 const verifiable=['mobility'];if(verifiable.includes(id)&&!missionEvidence(id,evidence)){alert('SYSTEM: Today’s logged training does not yet satisfy '+m.title+'. Complete the mission requirement before claiming XP.');return;}
 if(m.rankMission&&!missionEvidence(id,evidence)){alert('SYSTEM: Today’s logged training does not yet satisfy '+m.title+'. Complete the Rank Mission requirement before claiming XP.');return;} if(m.rankMission)s.rankMissionClaims[m.id]={claimedAt:new Date().toISOString(),rank:m.rank}; const dailyIds=dailySideMissions().map(x=>x.id),before=s.completed.filter(x=>dailyIds.includes(x)).length,earned=rewardXp(m.xp,s);s.completed.push(id);const dailyCompleted=s.completed.filter(x=>dailyIds.includes(x)).length;let bonus=0;if(before<3&&dailyCompleted>=3&&!s.sideBonus3){s.sideBonus3=true;bonus+=50}if(before<5&&dailyCompleted>=5&&!s.sideBonus5){s.sideBonus5=true;bonus+=100}saveSideSystem(s);
 if(m.id==='growth'&&typeof window!=='undefined'&&window.SystemBuild?.awardSideGrowth)window.SystemBuild.awardSideGrowth(m.stat,1);
 if(typeof addXp==='function'){addXp(earned,'side-mission');if(bonus)addXp(bonus,'side-mission-bonus')}
 if(typeof addSystemMessage==='function'){addSystemMessage('Side Mission Complete: '+m.title+' — +'+earned+' XP','quest');if(bonus)addSystemMessage('SIDE MISSION MILESTONE: '+dailyCompleted+'/5 — +'+bonus+' BONUS XP','quest')}
 if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem();if(bonus)setTimeout(()=>alert('SIDE MISSION MILESTONE\n'+dailyCompleted+'/5 COMPLETE\n+'+bonus+' BONUS XP'),100)}
function startBoss(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem();if(!b||!eligible(b,s))return;const prior=s.boss[rank],fresh=!prior||prior.activeVariant==null;ensureAttempt(b,s);if(fresh&&window.SystemProgression?.bossUnlocked)window.SystemProgression.bossUnlocked(b.title);setTimeout(()=>openBossBattle(rank),fresh?650:0)}
function ensureBattleUI(){let el=document.getElementById('bossBattleMode');if(el)return el;el=document.createElement('div');el.id='bossBattleMode';el.className='boss-battle-mode';el.innerHTML='<div class="bb-top"><div><span class="side-tag">SYSTEM • RANK TRIAL</span><h2 id="bbTitle">BOSS STAGE</h2></div><button id="bbExit">✕</button></div><div class="bb-hud"><span id="bbRank"></span><span id="bbAttempt"></span><span id="bbClock">00:00</span></div><div class="bb-hp"><div><span>BOSS HP</span><strong id="bbHpText">100 / 100</strong></div><div class="bb-hp-track"><i id="bbHpBar"></i></div></div><main class="bb-arena"><span id="bbCount" class="side-tag"></span><p id="bbFocus"></p><h1 id="bbObjective"></h1><div id="bbAttack" class="bb-attack"></div><div id="bbTimerPanel" class="bb-timer" hidden><strong id="bbTimer">00:00</strong><button id="bbTimerStart">START TIMER</button></div><button id="bbComplete" class="bb-main">COMPLETE OBJECTIVE</button><button id="bbEnd" class="bb-end">END ATTEMPT</button></main><div id="bbFlash" class="bb-flash"></div>';document.body.appendChild(el);document.getElementById('bbExit').onclick=closeBossBattle;return el}
function openBossBattle(rank){const el=ensureBattleUI();el.dataset.rank=rank;el.classList.add('active','boss-intro');setTimeout(()=>el.classList.remove('boss-intro'),900);document.body.classList.add('boss-mode-open');const s=loadSideSystem(),e=s.boss[rank];battleStartedAt=e?.startedAt?new Date(e.startedAt).getTime():Date.now();clearInterval(bossClock);bossClock=setInterval(updateBattleClock,1000);updateBattleClock();renderBossBattle()}
function closeBossBattle(){clearInterval(bossClock);clearInterval(bossTimer);const el=document.getElementById('bossBattleMode');if(el)el.classList.remove('active');document.body.classList.remove('boss-mode-open');renderSideSystem()}
function updateBattleClock(){const e=document.getElementById('bbClock');if(!e)return;const n=Math.floor((Date.now()-battleStartedAt)/1000);e.textContent=sideFmt(n)}
function sideFmt(n){n=Math.max(0,Math.floor(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function battleData(){const rank=document.getElementById('bossBattleMode')?.dataset.rank,b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem(),e=b?s.boss[rank]:null;if(!b||!e||e.activeVariant==null)return null;const v=b.variants[e.activeVariant],order=e.order||v.tasks.map((_,i)=>i),pos=Math.min(e.current||0,order.length-1);return{rank,b,s,e,v,order,obj:v.tasks[order[pos]]}}
function renderBossBattle(){const d=battleData();if(!d){closeBossBattle();return}const{rank,b,e,v,order,obj}=d,hp=Math.max(0,100-(e.damage||0));document.getElementById('bbTitle').textContent=v.name;document.getElementById('bbRank').textContent=rank+'-CLASS AT STAKE';document.getElementById('bbAttempt').textContent='ATTEMPT '+((e.attempts||0)+1);document.getElementById('bbHpText').textContent=hp+' / 100';document.getElementById('bbHpBar').style.width=hp+'%';document.getElementById('bossBattleMode')?.style.setProperty('--boss-hp',hp+'%');document.getElementById('bbCount').textContent='OBJECTIVE '+((e.current||0)+1)+' / '+order.length+' REVEALED';document.getElementById('bbFocus').textContent=v.focus;document.getElementById('bbObjective').textContent=obj.text;document.getElementById('bbAttack').textContent=obj.attack+' • '+obj.damage+' DAMAGE';const panel=document.getElementById('bbTimerPanel'),complete=document.getElementById('bbComplete');clearInterval(bossTimer);if(obj.seconds){panel.hidden=false;const objectiveIndex=order[e.current||0],same=e.timerObjective===objectiveIndex,remaining=same&&e.timerEndsAt?Math.max(0,Math.ceil((e.timerEndsAt-Date.now())/1000)):obj.seconds,done=same&&e.timerComplete||same&&e.timerEndsAt&&remaining<=0;if(done&&!e.timerComplete){e.timerComplete=true;e.timerEndsAt=null;d.s.boss[rank]=e;saveSideSystem(d.s)}document.getElementById('bbTimer').textContent=sideFmt(done?0:remaining);document.getElementById('bbTimerStart').textContent=done?'TIMER COMPLETE':same&&e.timerEndsAt?'TIMER RUNNING':'START TIMER';document.getElementById('bbTimerStart').disabled=!!done||!!(same&&e.timerEndsAt);complete.disabled=!done;if(!done&&same&&e.timerEndsAt)runObjectiveTimer(obj.seconds,true);else document.getElementById('bbTimerStart').onclick=()=>runObjectiveTimer(obj.seconds,false)}else{panel.hidden=true;complete.disabled=false}complete.onclick=()=>completeBossObjective(rank);document.getElementById('bbEnd').onclick=()=>endBossAttempt(rank)}
function runObjectiveTimer(seconds,resume=false){const d=battleData();if(!d)return;const{rank,s,e,order}=d,objectiveIndex=order[e.current||0];if(!resume){e.timerObjective=objectiveIndex;e.timerEndsAt=Date.now()+seconds*1000;e.timerComplete=false;s.boss[rank]=e;saveSideSystem(s)}const btn=document.getElementById('bbTimerStart'),out=document.getElementById('bbTimer'),complete=document.getElementById('bbComplete');btn.disabled=true;btn.textContent='TIMER RUNNING';clearInterval(bossTimer);const tick=()=>{const fresh=battleData();if(!fresh||fresh.rank!==rank){clearInterval(bossTimer);return}const fe=fresh.e,left=Math.max(0,Math.ceil(((fe.timerEndsAt||Date.now())-Date.now())/1000));out.textContent=sideFmt(left);if(left<=0){clearInterval(bossTimer);fe.timerComplete=true;fe.timerEndsAt=null;fresh.s.boss[rank]=fe;saveSideSystem(fresh.s);btn.textContent='TIMER COMPLETE';complete.disabled=false}};tick();bossTimer=setInterval(tick,500)}
function completeBossObjective(rank){const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e,v,order,obj}=d;e.damage=(e.damage||0)+obj.damage;e.checks=e.checks||[];e.checks[order[e.current||0]]=true;e.current=(e.current||0)+1;e.timerObjective=null;e.timerEndsAt=null;e.timerComplete=false;s.boss[rank]=e;saveSideSystem(s);showHit(obj);if(e.current>=order.length){setTimeout(()=>defeatBoss(rank),650)}else setTimeout(renderBossBattle,650)}
function showHit(obj){window.SystemAudio?.play(obj.attack&&/critical/i.test(obj.attack)?'critical':'boss_hit');const f=document.getElementById('bbFlash');if(!f)return;f.textContent=obj.attack+'  -'+obj.damage+' HP';f.classList.remove('hit');void f.offsetWidth;f.classList.add('hit')}
function endBossAttempt(rank){const d=battleData();if(!d||d.rank!==rank)return;showBossEndConfirm(rank)}
function showBossEndConfirm(rank){const d=battleData();if(!d||d.rank!==rank)return;const el=ensureBattleUI(),existing=document.getElementById('bbEndConfirm');if(existing)existing.remove();const modal=document.createElement('div');modal.id='bbEndConfirm';modal.className='bb-confirm';modal.innerHTML='<div class="bb-confirm-card"><span class="side-tag">SYSTEM • CONFIRM ACTION</span><h2>END BOSS ATTEMPT?</h2><p>Your completed objectives will be recorded, but this attempt will count as a failure.</p><div class="bb-confirm-actions"><button id="bbKeepFighting" class="bb-main">KEEP FIGHTING</button><button id="bbConfirmEnd" class="bb-end">END ATTEMPT</button></div></div>';el.appendChild(modal);document.getElementById('bbKeepFighting').onclick=()=>modal.remove();document.getElementById('bbConfirmEnd').onclick=()=>{modal.remove();finalizeBossAttempt(rank)}}
function finalizeBossAttempt(rank){const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e}=d,completed=(e.checks||[]).filter(Boolean).length,damage=e.damage||0,analysis=analyzeBossFailure(rank);e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed,total:5,damage,date:new Date().toISOString(),passed:false});e.lastVariant=e.activeVariant;e.activeVariant=null;e.order=[];e.current=0;e.damage=0;e.checks=[];e.timerObjective=null;e.timerEndsAt=null;e.timerComplete=false;saveSideSystem(s);if(typeof addSystemMessage==='function')addSystemMessage('BOSS SURVIVED — '+completed+'/5 objectives • '+damage+' damage. Performance recorded.','quest');clearInterval(bossClock);clearInterval(bossTimer);const el=ensureBattleUI();el.innerHTML='<div class="bb-result bb-defeat"><span class="side-tag">SYSTEM • BATTLE REPORT</span><h1>BOSS SURVIVED</h1><p>ATTEMPT RECORDED</p><div class="bb-result-stats"><div><strong>'+completed+'/5</strong><small>OBJECTIVES</small></div><div><strong>'+damage+'</strong><small>DAMAGE</small></div><div><strong>'+e.attempts+'</strong><small>ATTEMPTS</small></div></div><div class="bb-analysis"><small>POST-BATTLE ANALYSIS</small><b>'+analysis+'</b><span>Next attempt will use a different trial pattern.</span></div><button id="bbRetry" class="bb-main">PREPARE NEXT ATTEMPT</button><button id="bbResultClose" class="bb-end">RETURN TO SYSTEM</button></div>';document.getElementById('bbRetry').onclick=()=>{el.remove();document.body.classList.remove('boss-mode-open');renderSideSystem();startBoss(rank)};document.getElementById('bbResultClose').onclick=()=>{el.remove();document.body.classList.remove('boss-mode-open');renderSideSystem()}}
function defeatBoss(rank){window.SystemAudio?.play('boss_defeated');const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e}=d;e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed:5,total:5,damage:100,date:new Date().toISOString(),passed:true});e.lastVariant=e.activeVariant;e.activeVariant=null;e.order=[];e.current=0;e.damage=0;e.checks=[];e.timerObjective=null;e.timerEndsAt=null;e.timerComplete=false;e.passed=true;e.passedAt=new Date().toISOString();s.boss[rank]=e;saveSideSystem(s);if(typeof addXp==='function')addXp(b.reward,'boss-stage');if(typeof addSystemMessage==='function')addSystemMessage('BOSS DEFEATED! RANK PROMOTION: '+rank+'-CLASS — +'+b.reward+' XP','level');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();setTimeout(()=>window.SystemProgression?.show?.('rank','RANK PROMOTION',rank+'-CLASS','BOSS DEFEATED // NEW SYSTEM ACCESS AUTHORIZED'),350);const unlock=rankRewardSummary(rank),newMissions=RANK_MISSIONS.filter(m=>m.rank===rank).map(m=>m.title),elapsed=e.startedAt?Math.max(0,Math.round((Date.now()-new Date(e.startedAt).getTime())/1000)):0,elapsedText=Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0');const el=ensureBattleUI();clearInterval(bossClock);clearInterval(bossTimer);el.innerHTML='<div class="bb-result bb-victory"><span class="side-tag">SYSTEM • VICTORY REPORT</span><h1>BOSS DEFEATED</h1><p>RANK PROMOTION ACHIEVED</p><div class="bb-new-rank">'+rank+'-CLASS</div><div class="bb-result-stats"><div><strong>5/5</strong><small>OBJECTIVES</small></div><div><strong>100</strong><small>DAMAGE</small></div><div><strong>'+elapsedText+'</strong><small>BATTLE TIME</small></div></div><div class="bb-analysis"><small>RANK REWARD UNLOCKED</small><b>'+unlock+'</b>'+(newMissions.length?'<span>NEW MISSION: '+newMissions.join(' • ')+'</span>':'')+'<span>+'+b.reward+' XP awarded</span></div><button id="bbVictoryClose" class="bb-main">CONTINUE</button></div>';document.getElementById('bbVictoryClose').onclick=()=>{el.remove();document.body.classList.remove('boss-mode-open');renderSideSystem()}}
if(typeof getRank==='function'){const levelRank=getRank;getRank=function(level){const s=loadSideSystem(),c=currentClass(s);if(c==='E')return levelRank(Math.min(level,9));const b=BOSS_STAGES.find(x=>x.rank===c);return b?levelRank(b.level):levelRank(level)}}
function ensureStatusScreen(){let el=document.getElementById('playerStatusScreen');if(el)return el;const anchor=document.getElementById('playerCard');if(!anchor)return null;el=document.createElement('section');el.id='playerStatusScreen';el.className='status-screen';anchor.insertAdjacentElement('afterend',el);return el}
function nextPromotion(s){const cur=currentClass(s),i=rankIndex(cur);return BOSS_STAGES[i]||null}
function statState(value,need){if(need&&value<need)return'NEEDS ATTENTION';if(value>=70)return'DEVELOPED';return'DEVELOPING'}
function systemIntelligence(){
 const b=loadBuild(),s=loadSideSystem(),next=nextPromotion(s),hist=typeof workoutHistory==='function'?workoutHistory():[],recent=hist.slice(-7),stats=b.stats||{},vals=BUILD_STATS.map(x=>Number(stats[x]||0));
 if(vals.every(v=>v===0))return {strength:'Not enough data',weak:'Not enough data',reason:'Complete your first logged workout so THE SYSTEM can analyze your build.',directive:'Complete a training session and establish your baseline.'};
 const strong=[...BUILD_STATS].sort((a,z)=>stats[z]-stats[a])[0],weak=[...BUILD_STATS].sort((a,z)=>stats[a]-stats[z])[0],path=b.path||'Balanced';
 const recovery=Number(stats.Recovery||0),consistency=Number(stats.Consistency||0),missed=typeof adaptiveWeekStatus==='function'?adaptiveWeekStatus().missed.length:0;
 let directive='',reason='';
 if(recovery<Math.max(10,Math.min(...vals.filter(v=>v>0)))){directive='Prioritize recovery or mobility today.';reason='Recovery is trailing the rest of your developed attributes.'}
 else if(missed){directive='Use the next safe opening for a make-up session. Do not double-stack full workouts.';reason=missed+' scheduled session'+(missed===1?' was':'s were')+' missed this week.'}
 else if(next&&weakestStats(next.rank).length){const w=weakestStats(next.rank)[0];directive=(correctiveMission(next.rank)?.desc||('Develop '+w.stat+'.'));reason=w.stat+' has the largest gap to '+next.rank+'-Class promotion standards.'}
 else {directive='Continue your '+path+' plan and maintain balanced development.';reason=recent.length?'Recent training is on track.':'More workout history will improve recommendations.'}
 return {strength:strong,weak,reason,directive,consistency};
}
const COMBAT_TITLES=[
 {id:'first_blood',name:'FIRST BLOOD',desc:'Defeat your first Weekly Gate Boss.',test:c=>c.victories>=1},
 {id:'gate_breaker',name:'GATE BREAKER',desc:'Defeat 10 Weekly Gate Bosses.',test:c=>c.victories>=10},
 {id:'critical_specialist',name:'CRITICAL SPECIALIST',desc:'Land 10 critical hits.',test:c=>c.criticals>=10},
 {id:'perfect_clear',name:'PERFECT CLEAR',desc:'Earn a 100 Mission Performance Score.',test:c=>c.bestScore>=100},
 {id:'boss_hunter',name:'BOSS HUNTER',desc:'Defeat a B-Rank or higher Weekly Gate Boss.',test:c=>c.highestIndex>=3}
];
function combatTitleState(s){
 const sessions=typeof workoutHistory==='function'?workoutHistory():[],victories=s.gateVictories||[],order=['E','D','C','B','A','S','S+','Shadow'],highest=victories.reduce((a,x)=>Math.max(a,order.indexOf(x.rank)),-1),ctx={victories:victories.length,criticals:sessions.filter(x=>x?.bossDamage?.critical).length,bestScore:sessions.reduce((n,x)=>Math.max(n,Number(x?.performance?.score)||0),0),highestIndex:highest};
 s.combatTitles=s.combatTitles||{unlocked:[],equipped:null};let changed=false;
 COMBAT_TITLES.forEach(t=>{if(t.test(ctx)&&!s.combatTitles.unlocked.includes(t.id)){s.combatTitles.unlocked.push(t.id);changed=true;if(typeof queueReward==='function')queueReward({type:'achievement',title:'TITLE UNLOCKED',detail:t.name,amount:0,intensity:'major',source:'combat'})}});
 if(changed)saveSideSystem(s);return{s:s.combatTitles,ctx}
}
function equipCombatTitle(id){
 const s=loadSideSystem(),t=COMBAT_TITLES.find(x=>x.id===id);if(!t)return;const c=combatTitleState(s);if(!c.s.unlocked.includes(id))return;c.s.equipped=c.s.equipped===id?null:id;saveSideSystem(s);renderPlayerStatus();if(typeof renderPlayerCard==='function')renderPlayerCard()
}
function renderPlayerStatus(){const el=ensureStatusScreen();if(!el)return;const b=loadBuild(),s=loadSideSystem(),cur=currentClass(s),next=nextPromotion(s),level=typeof state!=='undefined'?state.level:1,xp=typeof state!=='undefined'?state.xp:0,xpNeed=typeof xpNeededForLevel==='function'?xpNeededForLevel(level):100,req=next?(RANK_STANDARDS[next.rank]||{}):{},met=BUILD_STATS.filter(x=>b.stats[x]>=(req[x]||0)).length,missing=next?weakestStats(next.rank):[],strong=[...BUILD_STATS].sort((a,z)=>b.stats[z]-b.stats[a])[0],weak=[...BUILD_STATS].sort((a,z)=>b.stats[a]-b.stats[z])[0],ready=next?Math.round(BUILD_STATS.reduce((a,x)=>a+Math.min(1,b.stats[x]/Math.max(1,req[x]||1)),0)/BUILD_STATS.length*100):100,dir=next?correctiveMission(next.rank):null,intel=systemIntelligence(),victories=(s.gateVictories||[]),sessions=typeof workoutHistory==='function'?workoutHistory():[],bossDamage=sessions.reduce((n,x)=>n+(Number(x?.bossDamage?.damage)||0),0),criticals=sessions.filter(x=>x?.bossDamage?.critical).length,best=sessions.reduce((a,x)=>Number(x?.performance?.score||0)>Number(a?.performance?.score||0)?x:a,{}),rankOrder=['E','D','C','B','A','S','S+','Shadow'],highest=victories.reduce((a,x)=>rankOrder.indexOf(x.rank)>rankOrder.indexOf(a)?x.rank:a,'E'),titles=combatTitleState(s),equipped=COMBAT_TITLES.find(x=>x.id===titles.s.equipped);
el.innerHTML='<div class="status-head"><div><span class="side-tag">PLAYER STATUS</span><h2>LEVEL '+level+' • '+cur+'-CLASS</h2><p>Training Path: <strong>'+b.path+'</strong></p><button id="changeTrainingPath" class="path-change" type="button">CHANGE PATH</button></div><div class="status-xp"><span>EXP</span><strong>'+xp+' / '+xpNeed+'</strong></div></div><div class="status-progress-actions"><button id="viewProgressHistory" type="button">VIEW ASSESSMENT & PROGRESS HISTORY</button></div><div class="status-stat-grid">'+BUILD_STATS.map(x=>'<article class="status-stat '+(req[x]&&b.stats[x]<req[x]?'needs':'')+'"><div><strong>'+x+'</strong><span>'+Math.round(b.stats[x])+(next?' / '+req[x]:'')+'</span></div><div class="status-bar"><i style="width:'+Math.min(100,b.stats[x])+'%"></i></div><small>'+statState(b.stats[x],req[x])+'</small></article>').join('')+'</div><div class="status-analysis"><article><span class="side-tag">SYSTEM ANALYSIS</span><p><b>Primary Strength:</b> '+intel.strength+'</p><p><b>Needs Development:</b> '+intel.weak+'</p><p><b>Why:</b> '+intel.reason+'</p><p><b>Next Promotion:</b> '+(next?next.rank+'-Class':'MAX RANK')+'</p></article><article><span class="side-tag">BOSS READINESS</span><div class="readiness">'+ready+'%</div><div class="status-bar"><i style="width:'+ready+'%"></i></div><p>'+(next?met+'/6 build requirements met':'All promotion trials cleared')+'</p></article></div><div class="status-directive"><span class="side-tag">SYSTEM DIRECTIVE</span><strong>'+(dir?dir.stat+' requires development.':'BUILD STABILIZED')+'</strong><p>'+intel.directive+'</p></div>'+`<section class="combat-record"><div class="combat-record__head"><div><span class="side-tag">HUNTER // COMBAT RECORD</span><h3>GATE ENCOUNTER HISTORY</h3></div><strong>${victories.length} VICTORIES</strong></div><div class="combat-record__stats"><article><b>${victories.length}</b><span>GATES CLEARED</span></article><article><b>${bossDamage.toLocaleString()}</b><span>TOTAL BOSS DAMAGE</span></article><article><b>${criticals}</b><span>CRITICAL HITS</span></article><article><b>${victories.length?highest+'-RANK':'--'}</b><span>HIGHEST DEFEATED</span></article><article><b>${best.performance?.score??'--'}</b><span>BEST MISSION SCORE</span></article></div><div class="combat-record__recent"><span class="side-tag">RECENT ENCOUNTERS</span>${victories.length?victories.slice(0,5).map(v=>'<div><strong>'+v.boss+'</strong><span>'+v.rank+'-RANK • VICTORY</span><b>'+Number(v.damage||0).toLocaleString()+' DMG</b></div>').join(''):'<p>NO GATE VICTORIES RECORDED // DEFEAT A WEEKLY BOSS TO BEGIN</p>'}</div><div class="combat-titles"><div class="combat-record__head"><div><span class="side-tag">IDENTITY // TITLES</span><h3>COMBAT TITLES</h3></div><strong>${equipped?'EQUIPPED // '+equipped.name:'NO TITLE EQUIPPED'}</strong></div><div class="combat-title-grid">${COMBAT_TITLES.map(t=>{const unlocked=titles.s.unlocked.includes(t.id),on=titles.s.equipped===t.id;return '<button type="button" data-combat-title="'+t.id+'" '+(unlocked?'':'disabled')+' class="'+(on?'equipped ':'')+(unlocked?'unlocked':'locked')+'"><strong>'+t.name+'</strong><span>'+t.desc+'</span><small>'+(on?'EQUIPPED':unlocked?'TAP TO EQUIP':'LOCKED')+'</small></button>'}).join('')}</div></div></section>`;

document.getElementById('changeTrainingPath')?.addEventListener('click',openTrainingPathPicker);document.getElementById('viewProgressHistory')?.addEventListener('click',()=>openProgressHistory());
el.querySelectorAll('[data-combat-title]').forEach(x=>x.addEventListener('click',()=>equipCombatTitle(x.dataset.combatTitle)));
}
function openTrainingPathPicker(){let el=document.getElementById('trainingPathPicker');if(!el){el=document.createElement('div');el.id='trainingPathPicker';el.className='path-picker';document.body.appendChild(el)}const current=loadBuild().path;el.innerHTML='<div class="path-picker-card"><div class="path-picker-head"><div><span class="side-tag">SYSTEM • BUILD CONFIGURATION</span><h2>CHOOSE TRAINING PATH</h2><p>Your path guides progression. It never locks your character.</p></div><button id="closePathPicker">✕</button></div><div class="path-options">'+Object.entries(TRAINING_PATHS).map(([key,p])=>'<button class="path-option '+(key===current?'selected':'')+'" data-path="'+key+'"><strong>'+p.label+'</strong><span>'+p.desc+'</span><small>'+(p.boost.length?'FOCUS: '+p.boost.join(' + '):'FOCUS: EVEN DEVELOPMENT')+'</small></button>').join('')+'</div><p class="path-note">Changing paths keeps your Level, XP, Rank, attributes, achievements and workout history.</p></div>';el.classList.add('active');document.getElementById('closePathPicker').onclick=()=>el.classList.remove('active');el.querySelectorAll('[data-path]').forEach(x=>x.onclick=()=>{setTrainingPath(x.dataset.path);el.classList.remove('active')})}

/* ===== ASSESSMENT + PROMOTION PROGRESS HISTORY ===== */
function progressCheckpoints(){
 const b=loadBuild(),s=loadSideSystem(),out=[];
 let a=null;try{a=JSON.parse(localStorage.getItem(ASSESSMENT_KEY)||'null')}catch(e){}
 if(a||b.assessment){
  const x=a||b.assessment||{},raw=x.raw||b.assessment?.raw||{},scores=x.scores||b.assessment?.scores||{};
  out.push({id:'assessment',type:'assessment',title:'INITIAL ASSESSMENT',subtitle:'BASELINE',date:x.completedAt||b.assessment?.date||null,rank:x.rank||b.assessment?.class||'E',scores,raw});
 }
 BOSS_STAGES.forEach(stage=>{
  const entry=s.boss?.[stage.rank];if(!entry)return;
  (entry.history||[]).forEach((h,i)=>out.push({id:'boss-'+stage.rank+'-'+i,type:'boss',title:stage.title,subtitle:h.passed?'PASSED':'ATTEMPT',date:h.date||null,rank:stage.rank,passed:!!h.passed,completed:Number(h.completed)||0,total:Number(h.total)||5,damage:Number(h.damage)||0,variant:h.variant,focus:stage.variants?.[h.variant]?.focus||''}));
  if(entry.passed&&entry.assessment&&!out.some(x=>x.type==='boss'&&x.rank===stage.rank&&x.passed))out.push({id:'placement-'+stage.rank,type:'placement',title:stage.title,subtitle:'PLACEMENT CREDIT',date:entry.passedAt||null,rank:stage.rank,passed:true,completed:5,total:5,damage:100});
 });
 return out.sort((a,z)=>new Date(a.date||0)-new Date(z.date||0));
}
function progressDate(v){if(!v)return'--';const d=new Date(v);return Number.isNaN(d.getTime())?'--':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function ensureProgressHistory(){let el=document.getElementById('progressHistoryModal');if(el)return el;el=document.createElement('div');el.id='progressHistoryModal';el.className='progress-history-modal';document.body.appendChild(el);return el}
function checkpointDetails(x){
 if(x.type==='assessment'){
  const r=x.raw||{},s=x.scores||{},pushType=String(r.pushType||'').replace(/^./,m=>m.toUpperCase());
  return '<div class="progress-detail-grid"><article><span>CLASSIFICATION</span><strong>'+x.rank+'-CLASS</strong><small>'+progressDate(x.date)+'</small></article>'+['Strength','Endurance','Conditioning','Mobility','Recovery'].map(k=>'<article><span>'+k.toUpperCase()+'</span><strong>'+(s[k]??'--')+'</strong></article>').join('')+'</div><div class="progress-raw"><span class="side-tag">TEST RESULTS</span><p><b>Sit-to-stands:</b> '+(r.sit??'--')+' in 60 sec</p><p><b>Push-ups:</b> '+(r.push??'--')+(pushType?' • '+pushType:'')+'</p><p><b>Walk:</b> '+(r.walk??'--')+' / 8 min</p><p><b>March:</b> '+(r.march??'--')+' / 5 min</p><p><b>Mobility:</b> '+({1:'Limited',2:'Functional',3:'Comfortable'}[r.mobility]||'--')+'</p><p><b>Training readiness:</b> '+({1:'Low',2:'Moderate',3:'High'}[r.energy]||'--')+'</p></div>';
 }
 return '<div class="progress-detail-grid"><article><span>RESULT</span><strong>'+(x.passed?'PASSED':'ATTEMPT')+'</strong><small>'+progressDate(x.date)+'</small></article><article><span>RANK</span><strong>'+x.rank+'-CLASS</strong></article><article><span>OBJECTIVES</span><strong>'+x.completed+' / '+x.total+'</strong></article><article><span>DAMAGE</span><strong>'+x.damage+'</strong></article></div>'+(x.focus?'<p class="progress-focus"><b>Trial focus:</b> '+x.focus+'</p>':'');
}
function openProgressHistory(selectedId){
 const el=ensureProgressHistory(),items=progressCheckpoints(),base=items.find(x=>x.type==='assessment'),latest=items.slice().reverse().find(x=>x.type==='boss'&&x.passed)||base,selected=items.find(x=>x.id===selectedId)||latest||base;
 const timeline=items.length?items.map(x=>'<button type="button" data-checkpoint="'+x.id+'" class="'+(selected?.id===x.id?'selected':'')+'"><span>'+x.subtitle+'</span><strong>'+x.title+'</strong><small>'+progressDate(x.date)+' • '+x.rank+'-CLASS'+(x.type==='boss'?' • '+x.completed+'/'+x.total:'')+'</small></button>').join(''):'<p>NO CHECKPOINTS RECORDED</p>';
 let compare='';
 if(base&&latest&&latest.id!==base.id)compare='<div class="progress-compare"><span class="side-tag">BASELINE // CURRENT</span><div><article><small>STARTED</small><strong>'+base.rank+'-CLASS</strong><span>'+progressDate(base.date)+'</span></article><b>→</b><article><small>LATEST VERIFIED</small><strong>'+latest.rank+'-CLASS</strong><span>'+progressDate(latest.date)+'</span></article></div></div>';
 el.innerHTML='<div class="progress-history-card"><div class="progress-history-head"><div><span class="side-tag">PLAYER // DEVELOPMENT RECORD</span><h2>PROGRESS HISTORY</h2><p>Your initial assessment is preserved as the permanent baseline. Rank trials become checkpoints as you progress.</p></div><button id="closeProgressHistory" type="button">✕</button></div>'+compare+'<div class="progress-history-layout"><aside><span class="side-tag">CHECKPOINTS</span>'+timeline+'</aside><main><span class="side-tag">RESULT DETAILS</span><h3>'+(selected?.title||'NO RESULT')+'</h3>'+(selected?checkpointDetails(selected):'<p>Complete the Initial Assessment to establish your baseline.</p>')+'</main></div></div>';
 el.classList.add('active');document.getElementById('closeProgressHistory').onclick=()=>el.classList.remove('active');el.querySelectorAll('[data-checkpoint]').forEach(x=>x.onclick=()=>openProgressHistory(x.dataset.checkpoint));
}
window.SystemProgressHistory={open:openProgressHistory,checkpoints:progressCheckpoints};

window.renderPlayerStatus=renderPlayerStatus;
function analyzeBossFailure(rank){const missing=weakestStats(rank),c=correctiveMission(rank);if(!missing.length)return 'Build standards met. Continue developing all attributes.';return 'Weakest attribute: '+missing[0].stat+' ('+missing[0].value+'/'+missing[0].need+'). '+(c?'Directive: '+c.desc:'')}
function rankRewardSummary(rank){const r=RANK_REWARDS[rank]||RANK_REWARDS.E;return r.desc}

const ONBOARDING_KEY='systemOnboardingV2';
const ASSESSMENT_KEY='systemAwakeningAssessmentV1';
const ASSESSMENT_RANKS=['D','C'];
const ASSESSMENT_LEVEL={E:1,D:10,C:20};
function assessmentPlacementLevel(rank,scores,watchAdjustment=0){
 const physical=['Strength','Endurance','Conditioning'],support=['Mobility','Recovery'];
 const pavg=physical.reduce((n,x)=>n+(Number(scores?.[x])||0),0)/physical.length;
 const savg=support.reduce((n,x)=>n+(Number(scores?.[x])||0),0)/support.length;
 const composite=pavg*.8+savg*.2;
 const bands={E:{min:0,max:32,lo:1,hi:9},D:{min:32,max:60,lo:10,hi:19},C:{min:60,max:71,lo:20,hi:29}};
 const b=bands[rank]||bands.E,t=Math.max(0,Math.min(1,(composite-b.min)/Math.max(1,b.max-b.min)));
 return Math.max(b.lo,Math.min(b.hi,Math.round(b.lo+t*(b.hi-b.lo))+Math.max(-2,Math.min(2,Number(watchAdjustment)||0))));
}
function assessmentHealthCalibration(hr={}){
 const h=typeof healthTelemetry==='function'?healthTelemetry():{};
 const peak=Number(hr.peak)||0,recovery=Number(hr.recovery)||0,drop=peak&&recovery?Math.max(0,peak-recovery):0;
 if(h.status!=='connected')return {connected:false,heartRateAvailable:false,adjustment:0};
 // Wearable data is supporting context only. It never changes Class and currently does not alter placement.
 return {connected:true,heartRateAvailable:!!(peak&&recovery),peak,recovery,oneMinuteDrop:drop,adjustment:0};
}
const ASSESSMENT_BONUS={E:0,D:0,C:0};
function onboardingData(){try{return JSON.parse(localStorage.getItem(ONBOARDING_KEY)||'null')}catch(e){return null}}
function onboardingPath(goal){return {'fat-loss':'Fat Loss','muscle':'Muscle Building','strength':'Strength','endurance':'Endurance','balanced':'Balanced'}[goal]||'Balanced'}
function shouldOnboard(){return !!(typeof getCloudSession==='function'&&getCloudSession()?.access_token)&&!onboardingData()}
function resumePendingAssessment(){const ob=onboardingData();if(ob?.assessmentPending&&!localStorage.getItem(ASSESSMENT_KEY))showAwakeningAssessment(()=>{const fresh=onboardingData()||{};fresh.assessmentPending=false;localStorage.setItem(ONBOARDING_KEY,JSON.stringify(fresh));renderPlayerStatus()})}
function seedAssessmentStats(rank,scores){
 const b=loadBuild(),req=RANK_STANDARDS[rank]||{};
 BUILD_STATS.forEach(x=>{if(x==='Consistency'){b.stats[x]=0;return}const measured=Math.max(0,Math.min(100,Number(scores?.[x])||0));b.stats[x]=Math.max(Number(b.stats[x])||0,measured)});
 b.assessmentStandards={rank,met:Object.fromEntries(BUILD_STATS.filter(x=>x!=='Consistency').map(x=>[x,(Number(b.stats[x])||0)>=(Number(req[x])||0)]))};
 saveBuild(b);
}
function applyAssessmentPlacement(rank,scores,watchAdjustment=0){
 const s=loadSideSystem(),target=rankIndex(rank);
 BOSS_STAGES.forEach(b=>{if(rankIndex(b.rank)<=target&&ASSESSMENT_RANKS.includes(b.rank))s.boss[b.rank]={...(s.boss[b.rank]||{}),passed:true,assessment:true,passedAt:new Date().toISOString(),attempts:0,history:[]}});
 saveSideSystem(s);seedAssessmentStats(rank,scores);
 if(typeof state!=='undefined'){
  state.level=Math.max(state.level||1,assessmentPlacementLevel(rank,scores,watchAdjustment));
  state.performanceProfile=state.performanceProfile||{};
  const map={str:'Strength',end:'Endurance',agi:'Conditioning',vit:'Recovery'};
  Object.entries(map).forEach(([stat,key])=>{const measured=Math.max(0,Math.min(100,Number(scores?.[key])||0));const current=state.performanceProfile[stat]||{score:0,actions:0};state.performanceProfile[stat]={...current,score:Math.max(Number(current.score)||0,measured),actions:Math.max(Number(current.actions)||0,measured>0?1:0)}});
  if(typeof saveState==='function')saveState();
  if(typeof renderCommandHud==='function')renderCommandHud();
 }
}
function assessmentTrial(rank){
 const b=BOSS_STAGES.find(x=>x.rank===rank),v=b?.variants?.[2]||b?.variants?.[0];
 return v?{rank,title:b.title,focus:v.focus,tasks:v.tasks}:null;
}
function awakeningScore(v,max){return Math.max(0,Math.min(100,Math.round((Number(v)||0)/max*100)))}
function awakeningClass(scores){const physical=['Strength','Endurance','Conditioning'],support=['Mobility','Recovery'],pavg=Math.round(physical.reduce((n,x)=>n+scores[x],0)/physical.length),savg=Math.round(support.reduce((n,x)=>n+scores[x],0)/support.length),low=Math.min(...physical.map(x=>scores[x]));return pavg>=60&&savg>=45&&low>=50?'C':pavg>=32&&savg>=25&&low>=25?'D':'E'}
function awakeningPath(scores){const pairs=[['Strength','Strength'],['Endurance','Endurance'],['Conditioning','Fat Loss'],['Recovery','Muscle Building']].sort((a,z)=>scores[z[0]]-scores[a[0]]);return pairs[0]&&scores[pairs[0][0]]>=scores.Mobility+10?pairs[0][1]:'Balanced'}
// Separate instructions from controls so short landscape screens can use both sides.
function onboardingCard(content,actions){
 const safety=content.match(/^<p class="ob-safety">[\s\S]*?<\/p>/)?.[0]||'';
 content=content.slice(safety.length);
 const split=content.search(/<(?:div|label|input)\b/);
 const intro=split<0?content:content.slice(0,split),fields=split<0?'':content.slice(split);
 return '<div class="ob-card">'+safety+'<div class="ob-content"><div class="ob-intro">'+intro+'</div><div class="ob-fields">'+fields+'</div></div><div class="ob-actions">'+actions+'</div></div>';
}
function showAwakeningAssessment(done){
 let el=document.getElementById('awakeningAssessment');if(!el){el=document.createElement('div');el.id='awakeningAssessment';el.className='system-onboarding';document.body.appendChild(el)}
 el._stopAssessmentTimer?.();
 const durations=[60,360,120],timers=durations.map(seconds=>({remaining:seconds*1000,deadline:0}));let timerInterval=null;
 const freezeTimer=()=>{const t=timers[step];if(t?.deadline){t.remaining=Math.max(0,t.deadline-Date.now());t.deadline=0}clearInterval(timerInterval);timerInterval=null};
 el._stopAssessmentTimer=freezeTimer;
 function timerMarkup(){return step<3?'<div class="ob-countdown"><span>'+['SIT-TO-STANDS • 60 SECONDS','ENDURANCE • 6 MINUTES','CONDITIONING • 2 MINUTES'][step]+'</span><strong id="awClock" aria-label="Time remaining"></strong><div><button id="awTimerStart" type="button">START TIMER</button><button id="awTimerReset" type="button">RESET</button></div><small id="awTimerStatus" role="status">Start when you are ready.</small></div>':''}
 function paintTimer(){const t=timers[step];if(!t)return;if(t.deadline)t.remaining=Math.max(0,t.deadline-Date.now());const seconds=Math.ceil(t.remaining/1000);el.querySelector('#awClock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');el.querySelector('#awTimerStart').textContent=t.remaining===0?'COMPLETE':t.deadline?'PAUSE':t.remaining<durations[step]*1000?'RESUME':'START TIMER';el.querySelector('#awTimerStart').disabled=t.remaining===0;if(t.remaining===0){freezeTimer();el.querySelector('#awTimerStatus').textContent=step===2?'Conditioning complete. Capturing heart rate…':'Time complete. Enter your results.';if(step===2&&!data.heartRate?.peak){readAssessmentHr('peak').then(bpm=>{const s=el.querySelector('#awTimerStatus');if(s)s.textContent=bpm?'Heart rate captured. Rest quietly for 1 minute, then tap CONTINUE.':'No watch heart-rate sample found. Continue normally.'})}}}
 async function readAssessmentHr(label){try{if(window.AndroidHealthConnect?.getRecentHeartRate){const hr=await window.AndroidHealthConnect.getRecentHeartRate(3);const bpm=Number(hr?.latest)||0;if(bpm>0){data.heartRate={...(data.heartRate||{}),[label]:bpm,[label+'At']:hr.sampledAt||new Date().toISOString()};saveDraft();return bpm}}}catch(e){}return 0}
 function bindTimer(){if(step>=3)return;el.querySelector('#awTimerStart').onclick=async()=>{const t=timers[step];if(step===2&&!t.deadline&&t.remaining===durations[step]*1000)await readAssessmentHr('pre');if(t.deadline){freezeTimer();el.querySelector('#awTimerStatus').textContent='Paused.'}else{t.deadline=Date.now()+t.remaining;el.querySelector('#awTimerStatus').textContent='Timer running.';timerInterval=setInterval(paintTimer,250)}paintTimer()};el.querySelector('#awTimerReset').onclick=()=>{freezeTimer();timers[step].remaining=durations[step]*1000;el.querySelector('#awTimerStatus').textContent='Start when you are ready.';paintTimer()};paintTimer()}
 const ASSESSMENT_DRAFT_KEY='systemAwakeningAssessmentDraftV3';let draft={};try{draft=JSON.parse(localStorage.getItem(ASSESSMENT_DRAFT_KEY)||'{}')}catch(e){}let step=Math.max(0,Math.min(3,Number(draft.step)||0)),data={sit:0,push:0,pushType:'wall',enduranceMode:'walk',walk:0,walkEffort:2,march:0,marchEffort:2,overhead:2,squatMob:2,hinge:2,energy:2,heartRate:{},...(draft.data||{})},selectedPath=draft.selectedPath||loadBuild().path||'Balanced';const saveDraft=()=>localStorage.setItem(ASSESSMENT_DRAFT_KEY,JSON.stringify({step,data,selectedPath,savedAt:new Date().toISOString()}));
 const screens=[
  ()=>'<span class="side-tag">THE AWAKENING TRIAL • 1/5</span><h1>STRENGTH</h1><p>Do chair sit-to-stands for 60 seconds. Rest, then choose a comfortable push-up variation. Do one untimed set and enter your clean reps. Stop before form breaks down.</p><label class="ob-days">Sit-to-stands completed <input id="awSit" type="number" min="0" max="60" value="'+data.sit+'"></label><div class="aw-push-block"><span class="aw-push-label">PUSH-UP VARIATION</span><div class="ob-options aw-push-options">'+[['wall','Wall'],['incline','Incline'],['knee','Knee'],['standard','Standard']].map(x=>'<button type="button" data-push-type="'+x[0]+'" class="'+(data.pushType===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div><label class="ob-days">Push-up reps (untimed) <input id="awPush" type="number" min="0" max="50" value="'+data.push+'"></label></div>',
  ()=>'<span class="side-tag">THE AWAKENING TRIAL • 2/5</span><h1>ENDURANCE</h1><p>Choose an accessible activity and maintain a comfortable, purposeful pace for up to 6 minutes. Record your time and how hard the final minute felt.</p><div class="aw-push-block"><span class="aw-push-label">ENDURANCE ACTIVITY</span><div class="ob-options aw-push-options">'+[['walk','Outdoor walk'],['indoor','Indoor walk'],['march','March in place'],['step','Low step-ups'],['seated','Seated march']].map(x=>'<button type="button" data-endurance-mode="'+x[0]+'" class="'+(data.enduranceMode===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div></div><label class="ob-days">Minutes completed <input id="awWalk" type="number" min="0" max="6" step=".5" value="'+data.walk+'"></label><div class="aw-effort"><span class="aw-push-label">FINAL-MINUTE EFFORT</span><div class="ob-options">'+[['1','Easy'],['2','Moderate'],['3','Hard']].map(x=>'<button type="button" data-walk-effort="'+x[0]+'" class="'+(String(data.walkEffort)===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div><small>Easy = plenty left • Moderate = working but controlled • Hard = near your sustainable limit</small></div>',
  ()=>'<span class="side-tag">THE AWAKENING TRIAL • 3/5</span><h1>CONDITIONING</h1><p>March in place at a steady controlled pace for up to 5 minutes. Enter how long you maintained it, then rate how hard the final minute felt.</p><label class="ob-days">Minutes completed <input id="awMarch" type="number" min="0" max="5" step=".5" value="'+data.march+'"></label><div class="aw-effort"><span class="aw-push-label">FINAL-MINUTE EFFORT</span><div class="ob-options">'+[['1','Easy'],['2','Moderate'],['3','Hard']].map(x=>'<button type="button" data-march-effort="'+x[0]+'" class="'+(String(data.marchEffort)===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div><small>Easy = plenty left • Moderate = working but controlled • Hard = near your sustainable limit</small></div>',
  ()=>'<span class="side-tag">THE AWAKENING TRIAL • 4/5</span><h1>MOBILITY + RECOVERY</h1><p>Choose the description that best matches comfortable movement today.</p><div class="ob-options">'+[['1','Limited or uncomfortable'],['2','Functional with some restriction'],['3','Comfortable full movement']].map(x=>'<button data-mob="'+x[0]+'" class="'+(String(data.mobility)===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div><p>How ready do you feel to train today?</p><div class="ob-options">'+[['1','Low'],['2','Moderate'],['3','High']].map(x=>'<button data-energy="'+x[0]+'" class="'+(String(data.energy)===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div>',
  ()=>{const scores=calculate(),rank=awakeningClass(scores),rec=awakeningPath(scores);if(!selectedPath)selectedPath=rec;return '<span class="side-tag">THE AWAKENING TRIAL • 5/5</span><h1>CLASSIFICATION COMPLETE</h1><div class="ob-awaken"><small>INITIAL CLASSIFICATION</small><strong>'+rank+'-CLASS</strong><span>MAXIMUM INITIAL CLASS: C</span><small>Classification recognizes current capacity. Higher Classes must be earned through The System.</small></div><div class="assessment-list">'+['Strength','Endurance','Conditioning','Mobility','Recovery'].map(x=>'<p><b>'+x+':</b> '+scores[x]+'</p>').join('')+'<p><b>Consistency:</b> 0 • Earned inside The System</p></div><p>SYSTEM RECOMMENDATION: <strong>'+rec+'</strong></p><p>YOUR TRAINING PATH: <strong>'+selectedPath+'</strong></p><small>The System recommendation is guidance. Your chosen path remains in control and can be changed later from your Player Status.</small>'}
 ];
 function capture(){if(step===0){data.sit=Number(document.getElementById('awSit')?.value)||0;data.push=Number(document.getElementById('awPush')?.value)||0}if(step===1)data.walk=Number(document.getElementById('awWalk')?.value)||0;if(step===2)data.march=Number(document.getElementById('awMarch')?.value)||0}
 function calculate(){const INITIAL_CAP=70,pushFactor={wall:.6,incline:.78,knee:.9,standard:1}[data.pushType]||.6,push=Math.min(100,awakeningScore(data.push,20)*pushFactor),sit=awakeningScore(data.sit,30),walkPct=Math.max(0,Math.min(1,(Number(data.walk)||0)/6)),marchPct=Math.max(0,Math.min(1,(Number(data.march)||0)/2)),effortBonus=e=>({1:15,2:8,3:0}[e]??8),capacity=(pct,e)=>Math.round(Math.min(INITIAL_CAP,pct*47+(pct>=.75?effortBonus(e):0))),cap=v=>Math.min(INITIAL_CAP,Math.round(v));return {Strength:cap(sit*.6+push*.4),Endurance:cap(capacity(walkPct,data.walkEffort)*({walk:1,indoor:1,march:.92,step:1,seated:.85}[data.enduranceMode]??1)),Conditioning:capacity(marchPct,data.marchEffort),Mobility:cap(([data.overhead,data.squatMob,data.hinge].reduce((n,v)=>n+({1:25,2:50,3:65}[v]||50),0)/3)),Consistency:0,Recovery:cap(({1:25,2:50,3:65}[data.energy]||50))}}
 function finish(){freezeTimer();localStorage.removeItem(ASSESSMENT_DRAFT_KEY);const scores=calculate(),rank=awakeningClass(scores),health=assessmentHealthCalibration(data.heartRate),placementLevel=assessmentPlacementLevel(rank,scores,health.adjustment),b=loadBuild();BUILD_STATS.forEach(x=>b.stats[x]=scores[x]);const recommended=awakeningPath(scores);b.path=selectedPath||recommended;b.assessment={version:3,date:new Date().toISOString(),scores:{...scores},class:rank,raw:{...data}};saveBuild(b);applyAssessmentPlacement(rank,scores,health.adjustment);localStorage.setItem(ASSESSMENT_KEY,JSON.stringify({rank,placementLevel,scores,raw:data,recommendedPath:recommended,selectedPath:b.path,healthCalibration:health,bonus:0,completedAt:new Date().toISOString()}));el.classList.remove('active');if(typeof addSystemMessage==='function')addSystemMessage('THE AWAKENING TRIAL COMPLETE — '+rank+'-CLASS • Previous training recognized.','level');if(typeof renderAll==='function')renderAll();renderSideSystem();if(done)done(rank)}
 function render(){freezeTimer();el.classList.toggle('ob-summary',step===4);el.classList.toggle('ob-mobility',step===3);el.innerHTML=onboardingCard((step===4?'':'<p class="ob-safety"><b>Safety:</b> Use a stable chair and clear space. Stop immediately for pain, dizziness, chest pain, faintness, or unusual shortness of breath.</p>')+screens[step](),'<button id="awExit">SAVE & EXIT</button>'+(step?'<button id="awBack">BACK</button>':'')+'<button id="awNext" class="btn-primary">'+(step===4?'ACCEPT CLASSIFICATION':'CONTINUE')+'</button>');const fields=el.querySelector('.ob-fields');fields.insertAdjacentHTML('afterbegin',timerMarkup());bindTimer();el.classList.add('active');el.querySelectorAll('[data-endurance-mode]').forEach(x=>x.onclick=()=>{capture();data.enduranceMode=x.dataset.enduranceMode;saveDraft();render()});el.querySelectorAll('[data-push-type]').forEach(x=>x.onclick=()=>{data.pushType=x.dataset.pushType;render()});el.querySelectorAll('[data-walk-effort]').forEach(x=>x.onclick=()=>{capture();data.walkEffort=Number(x.dataset.walkEffort);saveDraft();render()});el.querySelectorAll('[data-march-effort]').forEach(x=>x.onclick=()=>{data.marchEffort=Number(x.dataset.marchEffort);render()});el.querySelectorAll('[data-overhead]').forEach(x=>x.onclick=()=>{data.overhead=Number(x.dataset.overhead);render()});el.querySelectorAll('[data-squat-mob]').forEach(x=>x.onclick=()=>{data.squatMob=Number(x.dataset.squatMob);render()});el.querySelectorAll('[data-hinge]').forEach(x=>x.onclick=()=>{data.hinge=Number(x.dataset.hinge);render()});el.querySelectorAll('[data-energy]').forEach(x=>x.onclick=()=>{data.energy=Number(x.dataset.energy);render()});document.getElementById('awExit')?.addEventListener('click',()=>{capture();freezeTimer();saveDraft();el.classList.remove('active');if(typeof addSystemMessage==='function')addSystemMessage('AWAKENING TRIAL PAUSED — complete your assessment to unlock Central Command.','level')});document.getElementById('awBack')?.addEventListener('click',()=>{capture();freezeTimer();step--;saveDraft();render()});document.getElementById('awNext').onclick=async()=>{capture();freezeTimer();if(step===2&&data.heartRate?.peak){const status=el.querySelector('#awTimerStatus');if(status)status.textContent='Reading 1-minute recovery heart rate…';await new Promise(r=>setTimeout(r,60000));await readAssessmentHr('recovery')}if(step<4){step++;saveDraft();render()}else finish()}}
 render();
}
function showOnboarding(){if(!shouldOnboard())return;let el=document.getElementById('systemOnboarding');if(!el){el=document.createElement('div');el.id='systemOnboarding';el.className='system-onboarding';document.body.appendChild(el)}let step=0,data={name:'',goal:'balanced',experience:'beginner',equipment:[],days:4,healthChoice:null};const screens=[
 ()=>'<span class="side-tag">CREATE PLAYER • 1/5</span><h1>WHO ARE YOU BECOMING?</h1><p>Set up your player profile. You can change these choices later.</p><input id="obName" class="form-input" placeholder="Player name" value="'+data.name+'">',
 ()=>'<span class="side-tag">PRIMARY GOAL • 2/5</span><h1>CHOOSE YOUR PATH</h1><p>The System will use this to guide your missions.</p><div class="ob-options">'+[['fat-loss','Fat Loss'],['muscle','Muscle Building'],['strength','Strength'],['endurance','Endurance'],['balanced','Balanced Fitness']].map(x=>'<button data-goal="'+x[0]+'" class="'+(data.goal===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div>',
 ()=>'<span class="side-tag">TRAINING PROFILE • 3/5</span><h1>EXPERIENCE</h1><p>This guides exercise selection. Your actual Class will be determined by the Awakening Assessment.</p><div class="ob-options">'+[['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']].map(x=>'<button data-exp="'+x[0]+'" class="'+(data.experience===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</div>',
 ()=>'<span class="side-tag">EQUIPMENT • 4/5</span><h1>PREPARE FOR ASSESSMENT</h1><p>Select your available gear and weekly training availability.</p><div class="ob-options ob-equipment">'+['No Equipment','Bodyweight','Dumbbells','Barbell','Resistance Bands','Cardio Machine','Full Gym'].map(x=>'<button data-eq="'+x+'" class="'+(data.equipment.includes(x)?'selected':'')+'">'+x+'</button>').join('')+'</div><label class="ob-days">Training days per week <input id="obDays" type="number" min="1" max="7" value="'+data.days+'"></label>',
 ()=>{const h=typeof healthTelemetry==='function'?healthTelemetry():{},linked=h.status==='connected',native=!!window.AndroidHealthConnect;return '<span class="side-tag">BIOMETRIC LINK • 5/5</span><h1>HEALTH CONNECT</h1><p>Optional wearable data can support assessment calibration. Your physical performance remains the primary score.</p><div class="ob-options"><button id="obHealthConnect" class="'+(linked?'selected':'')+'" '+(!native?'disabled':'')+'>'+(linked?'HEALTH CONNECTED • READY':native?'CONNECT HEALTH DATA':'HEALTH CONNECT UNAVAILABLE')+'</button><button id="obHealthSkip">CONTINUE WITHOUT HEALTH DATA</button></div><small>No wearable is required. Missing health data will never reduce your score.</small>'}
 ];function render(){el.classList.toggle('ob-path-screen',step===1);el.innerHTML=onboardingCard(screens[step](),(step?'<button id="obBack">BACK</button>':'')+'<button id="obNext" class="btn-primary">'+(step===4?'BEGIN ASSESSMENT':'CONTINUE')+'</button>');el.classList.add('active');el.querySelectorAll('[data-goal]').forEach(x=>x.onclick=()=>{data.goal=x.dataset.goal;render()});el.querySelectorAll('[data-exp]').forEach(x=>x.onclick=()=>{data.experience=x.dataset.exp;render()});el.querySelectorAll('[data-eq]').forEach(x=>x.onclick=()=>{data.equipment=data.equipment.includes(x.dataset.eq)?data.equipment.filter(v=>v!==x.dataset.eq):[...data.equipment,x.dataset.eq];render()});document.getElementById('obHealthConnect')?.addEventListener('click',async()=>{if(typeof syncHealthConnect==='function'){await syncHealthConnect();data.healthChoice=typeof healthTelemetry==='function'&&healthTelemetry().status==='connected'?'connected':null;render()}});document.getElementById('obHealthSkip')?.addEventListener('click',()=>{data.healthChoice='skipped';document.getElementById('obNext')?.click()});document.getElementById('obBack')?.addEventListener('click',()=>{step--;render()});document.getElementById('obNext').onclick=()=>{if(step===0)data.name=(document.getElementById('obName')?.value||'').trim()||'Player';if(step===3)data.days=Math.max(1,Math.min(7,Number(document.getElementById('obDays')?.value)||4));if(step<4){step++;render();return}const path=onboardingPath(data.goal),b=loadBuild();b.path=path;b.profile={experience:data.experience,equipment:data.equipment.length?data.equipment:['No Equipment'],days:data.days};saveBuild(b);localStorage.setItem(ONBOARDING_KEY,JSON.stringify({...data,path,assessmentPending:true,completedAt:new Date().toISOString()}));el.classList.remove('active');showAwakeningAssessment(()=>{const ob=onboardingData()||{};ob.assessmentPending=false;localStorage.setItem(ONBOARDING_KEY,JSON.stringify(ob));renderPlayerStatus()})}}render()}
window.SystemOnboarding={show:showOnboarding,assessment:showAwakeningAssessment,reset:()=>{localStorage.removeItem(ONBOARDING_KEY);localStorage.removeItem(ASSESSMENT_KEY)}};
document.addEventListener('DOMContentLoaded',()=>{renderSideSystem();renderPlayerStatus();setTimeout(()=>{if(shouldOnboard())showOnboarding();else resumePendingAssessment()},250)});

/* ===== DAILY SYSTEM BOOT + MISSION BRIEFING ===== */
const SYSTEM_BOOT_KEY='theSystemDailyBriefing';
function systemBootDay(){return typeof today==='function'?today():new Date().toLocaleDateString('en-CA')}
function dailyBriefingData(){
 const ss=loadSideSystem(),b=loadBuild(),level=typeof state!=='undefined'?state.level:1,rank=currentClass(ss),intel=systemIntelligence(),daily=dailySideMissions(),done=daily.filter(m=>ss.completed.includes(m.id)).length,next=nextPromotion(ss),rankMission=unlockedMissions(ss).find(m=>m.rankMission&&!ss.rankMissionClaims[m.id]),growth=daily.find(m=>m.growth),missionTitle=document.getElementById('mission-title')?.textContent?.trim()||"Today's Training",missionSummary=document.getElementById('homeMissionSummary')?.textContent?.trim()||'Training Mission',boss=next?(eligible(next,ss)?next.rank+'-CLASS TRIAL READY':next.rank+'-Class • requirements pending'):'ALL PROMOTIONS CLEARED';
 const perf=typeof getPerformanceAnalysis==='function'?getPerformanceAnalysis():null,rec=typeof recommendPerformanceMission==='function'?recommendPerformanceMission():null;
 const perfReady=perf&&perf.rows.some(x=>x.score>0);
 return{level,rank,path:b.path||'Balanced',intel,done,growth,rankMission,missionTitle,missionSummary,boss,streak:typeof state!=='undefined'?(state.currentStreak||0):0,perf,perfReady,rec}
}
function renderDailyBriefing(){
 const boot=document.getElementById('systemBoot');if(!boot||localStorage.getItem(SYSTEM_BOOT_KEY)===systemBootDay())return;
 const d=dailyBriefingData(),welcome=document.getElementById('systemWelcome'),brief=document.getElementById('systemBriefing');boot.hidden=false;welcome.hidden=false;brief.hidden=true;document.body.classList.add('system-boot-open');
 document.getElementById('systemWelcomePlayer').textContent='Welcome back, '+(typeof state!=='undefined'&&state.playerName?state.playerName:'Hunter')+'.';
 document.getElementById('systemWelcomeRank').textContent='LEVEL '+d.level+' • '+d.rank+'-CLASS • '+d.streak+' DAY STREAK';
 document.getElementById('briefingDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
 const analysis=d.perfReady?'<article class="briefing-analysis"><span>SYSTEM ANALYSIS</span><strong>'+performanceLabel(d.perf.strongest.stat)+' LEADING</strong><small>'+performanceLabel(d.perf.weakest.stat)+' selected for development</small></article>':'<article class="briefing-analysis"><span>SYSTEM ANALYSIS</span><strong>ESTABLISHING BASELINE</strong><small>Complete missions to calibrate player development</small></article>';
 const recommendation='<article class="briefing-recommendation"><span>RECOMMENDED SIDE OBJECTIVE</span><strong>'+(d.rec?.title||'Recovery + Mobility')+'</strong><small>'+(d.perfReady?performanceLabel(d.rec?.stat||'vit')+' development priority':'Balanced development protocol')+'</small></article>';
 document.getElementById('briefingGrid').innerHTML='<article><span>PRIMARY MISSION</span><strong>'+d.missionTitle+'</strong><small>'+d.missionSummary+'</small></article>'+analysis+recommendation+'<article><span>SIDE MISSIONS</span><strong>'+d.done+' / 5 COMPLETE</strong><small>'+Math.max(0,5-d.done)+' objectives remaining</small></article><article><span>RANK MISSION</span><strong>'+(d.rankMission?d.rankMission.title:'NO ACTIVE RANK MISSION')+'</strong><small>'+(d.rankMission?d.rankMission.desc:'Continue current progression')+'</small></article><article class="briefing-boss"><span>BOSS STATUS</span><strong>'+d.boss+'</strong><small>Promotion progression</small></article>';
 document.getElementById('briefingDirective').innerHTML='<span>SYSTEM DIRECTIVE</span><strong>'+d.intel.directive+'</strong><small>'+d.intel.reason+'</small>';
 const begin=document.getElementById('systemBeginDay');begin.textContent='BEGIN MISSION →';begin.disabled=false;
 let transitionTimer;
 const closeBriefing=()=>{clearTimeout(transitionTimer);boot.hidden=true;boot.classList.remove('boot-transition','system-deploy');welcome.classList.remove('panel-exit');brief.classList.remove('panel-enter','panel-enter-active');document.body.classList.remove('system-boot-open','system-entering');localStorage.setItem(SYSTEM_BOOT_KEY,systemBootDay())};
 document.getElementById('systemBootClose').onclick=closeBriefing;
 document.getElementById('systemWelcomeContinue').onclick=()=>{boot.classList.add('boot-transition');welcome.classList.add('panel-exit');transitionTimer=setTimeout(()=>{welcome.hidden=true;welcome.classList.remove('panel-exit');brief.hidden=false;brief.classList.add('panel-enter');requestAnimationFrame(()=>brief.classList.add('panel-enter-active'));boot.classList.remove('boot-transition')},360)};
 begin.onclick=()=>{if(begin.disabled)return;begin.disabled=true;boot.classList.add('system-deploy');document.body.classList.add('system-entering');transitionTimer=setTimeout(()=>{closeBriefing();const deck=document.getElementById('commandDeck');deck?.classList.add('command-arrival');setTimeout(()=>deck?.classList.remove('command-arrival'),1300);if(window.SystemOS?.open)window.SystemOS.open('missions');else document.querySelector('.app-nav [data-view="missions"]')?.click();window.SystemOS?.notify?.('MISSION CONTROL READY','SYSTEM // DEPLOYMENT')},780)}
}
function scheduleDailyBriefing(){let tries=0;const wait=()=>{tries++;if(typeof state!=='undefined'&&document.getElementById('mission-title'))renderDailyBriefing();else if(tries<20)setTimeout(wait,150)};setTimeout(wait,250)}
document.addEventListener('DOMContentLoaded',scheduleDailyBriefing);

/* ===== DAILY BRIEFING REPLAY ===== */
function replayDailyBriefing(){localStorage.removeItem(SYSTEM_BOOT_KEY);renderDailyBriefing()}
document.addEventListener('DOMContentLoaded',()=>document.getElementById('replayDailyBriefing')?.addEventListener('click',replayDailyBriefing));
