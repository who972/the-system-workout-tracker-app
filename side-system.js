/* THE SYSTEM: Side Missions + Full-Screen Boss Battles */
const SIDE_SYSTEM_KEY='systemMission:sideBossV3';
const RANK_REWARDS={
 E:{label:'AWAKENED',desc:'Core daily Side Missions'},
 D:{label:'HUNTER',desc:'Challenge Missions unlocked',bonus:10},
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
const SIDE_MISSIONS=[
{id:'walk20',title:'Extra Mile',desc:'Walk for 20 minutes outside your scheduled workout.',xp:50},
{id:'hydrate',title:'Hydration Mission',desc:'Hit your daily water target.',xp:25},
{id:'protein',title:'Protein Protocol',desc:'Hit your daily protein target.',xp:25},
{id:'core50',title:'Core Assault',desc:'Complete 50 total core reps.',xp:40},
{id:'mobility',title:'Recovery Mission',desc:'Complete 10 minutes of stretching or mobility.',xp:30},
{id:'weekend',title:'Weekend Warrior',desc:'Complete an extra Saturday or Sunday workout.',xp:75}
];
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
function loadSideSystem(){let s={};try{s=JSON.parse(localStorage.getItem(SIDE_SYSTEM_KEY)||'{}')}catch(e){}if(s.date!==today())s={...s,date:today(),completed:[]};s.completed=s.completed||[];s.boss=s.boss||{};return s}
function saveSideSystem(s){localStorage.setItem(SIDE_SYSTEM_KEY,JSON.stringify(s))}
function currentClass(s){let c='E';for(const b of BOSS_STAGES)if(s.boss[b.rank]?.passed)c=b.rank;return c}
function rankIndex(rank){return ['E','D','C','B','A','S','S+','Shadow'].indexOf(rank)}
function unlockedMissions(s){const ci=rankIndex(currentClass(s));return SIDE_MISSIONS.concat(RANK_MISSIONS.filter(m=>rankIndex(m.rank)<=ci))}
function rewardXp(base,s){const r=RANK_REWARDS[currentClass(s)]||RANK_REWARDS.E;return Math.round(base*(1+(r.bonus||0)/100))}
function bossIndex(rank){return BOSS_STAGES.findIndex(b=>b.rank===rank)}
function eligible(b,s){const i=bossIndex(b.rank),level=typeof state!=='undefined'?state.level:1;return level>=b.level&&(i===0||!!s.boss[BOSS_STAGES[i-1].rank]?.passed)}
function chooseVariant(b,e){let n=Math.floor(Math.random()*b.variants.length);if(b.variants.length>1&&n===e.lastVariant)n=(n+1+Math.floor(Math.random()*(b.variants.length-1)))%b.variants.length;return n}
function shuffle(n){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function ensureAttempt(b,s){const e=s.boss[b.rank]||{attempts:0,history:[]};if(e.activeVariant==null){e.activeVariant=chooseVariant(b,e);e.order=shuffle(b.variants[e.activeVariant].tasks.length);e.current=0;e.damage=0;e.checks=[];e.startedAt=new Date().toISOString()}e.history=e.history||[];s.boss[b.rank]=e;saveSideSystem(s);return e}

function ensureRankPath(){let el=document.getElementById('rankPathPanel');if(el)return el;const root=document.getElementById('sideMissionSystem');if(!root)return null;el=document.createElement('section');el.id='rankPathPanel';el.className='rank-path-panel';const grid=root.querySelector('.side-system-grid');root.insertBefore(el,grid||root.firstChild);return el}
function renderRankPath(){const el=ensureRankPath();if(!el)return;const s=loadSideSystem(),cur=currentClass(s),ci=rankIndex(cur),level=typeof state!=='undefined'?state.level:1;
 const stages=[{rank:'E',level:1,title:'Awakened',boss:'No promotion trial',reward:RANK_REWARDS.E},...BOSS_STAGES.map(b=>({rank:b.rank,level:b.level,title:b.title,boss:b.variants.length+' possible Boss Trials',reward:RANK_REWARDS[b.rank]}))];
 el.innerHTML='<div class="rank-path-head"><div><span class="side-tag">PLAYER PROGRESSION</span><h2>RANK PATH</h2><p>Level '+level+' • Current Rank: '+cur+'-CLASS</p></div><button id="rankPathToggle" type="button">VIEW PATH</button></div><div id="rankPathTrack" class="rank-path-track">'+stages.map((x,i)=>{const cleared=i<ci||(i===0&&ci>0),current=i===ci,locked=i>ci,boss=BOSS_STAGES.find(b=>b.rank===x.rank),entry=boss?s.boss[x.rank]:null,status=cleared?'CLEARED':current?'CURRENT':'LOCKED';return '<article class="rank-node '+(cleared?'cleared ':current?'current ':'locked ')+'"><div class="rank-node-line"></div><div class="rank-emblem">'+x.rank+'</div><div class="rank-node-copy"><span class="side-tag">'+status+'</span><h3>'+x.title+'</h3><p>Level '+x.level+' • '+x.boss+'</p><p>'+x.reward.desc+'</p>'+(entry&&entry.attempts?'<small>'+entry.attempts+' Boss attempt'+(entry.attempts===1?'':'s')+'</small>':'')+'</div></article>'}).join('')+'</div>';
 const btn=document.getElementById('rankPathToggle'),track=document.getElementById('rankPathTrack');btn.onclick=()=>{const open=track.classList.toggle('open');btn.textContent=open?'HIDE PATH':'VIEW PATH'}
}

function renderSideSystem(){const root=document.getElementById('sideMissionSystem');if(!root)return;const s=loadSideSystem(),missions=document.getElementById('sideMissionList');renderRankPath();
const available=unlockedMissions(s);missions.innerHTML=available.map(m=>'<article class="side-card '+(s.completed.includes(m.id)?'is-done':'')+'"><div><span class="side-tag">SIDE MISSION</span><h3>'+m.title+'</h3><p>'+m.desc+'</p></div><div class="side-reward">+'+m.xp+' XP</div><button data-side="'+m.id+'" '+(s.completed.includes(m.id)?'disabled':'')+'>'+(s.completed.includes(m.id)?'COMPLETE':'CLAIM COMPLETE')+'</button></article>').join('');
missions.querySelectorAll('[data-side]').forEach(x=>x.onclick=()=>completeSideMission(x.dataset.side));const cls=currentClass(s),reward=RANK_REWARDS[cls]||RANK_REWARDS.E;document.getElementById('currentRankClass').textContent=cls+'-CLASS • '+reward.label;
const wrap=document.getElementById('bossStageList');wrap.innerHTML=BOSS_STAGES.map(b=>{const e=s.boss[b.rank]||{attempts:0,history:[]},best=(e.history||[]).reduce((m,x)=>Math.max(m,x.completed||0),0);
if(e.passed)return '<article class="boss-card boss-passed"><span class="side-tag">BOSS DEFEATED</span><h3>'+b.title+'</h3><p>Promotion achieved • +'+b.reward+' XP</p><button disabled>'+b.rank+'-CLASS UNLOCKED</button></article>';
if(!eligible(b,s))return '<article class="boss-card boss-locked"><span class="side-tag">LOCKED</span><h3>'+b.title+'</h3><p>Requires Level '+b.level+(bossIndex(b.rank)>0?' + previous promotion':'')+'</p><button disabled>LOCKED</button></article>';
return '<article class="boss-card boss-ready"><span class="side-tag">BOSS INTEL</span><h3>'+b.title+'</h3><p>Level '+b.level+' • +'+b.reward+' XP • '+b.variants.length+' possible trials</p><p>Attempts: '+(e.attempts||0)+' • Best: '+best+'/5</p><p>Objectives and order are classified until battle begins.</p><button data-start="'+b.rank+'">'+(e.activeVariant!=null?'RESUME BOSS BATTLE':'BEGIN RANK TRIAL')+'</button></article>'}).join('');
wrap.querySelectorAll('[data-start]').forEach(x=>x.onclick=()=>startBoss(x.dataset.start))}
function completeSideMission(id){const s=loadSideSystem(),m=unlockedMissions(s).find(x=>x.id===id);if(!m||s.completed.includes(id))return;const earned=rewardXp(m.xp,s);s.completed.push(id);saveSideSystem(s);if(typeof addXp==='function')addXp(earned,'side-mission');if(typeof addSystemMessage==='function')addSystemMessage('Side Mission Complete: '+m.title+' — +'+earned+' XP','quest');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem()}
function startBoss(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem();if(!b||!eligible(b,s))return;ensureAttempt(b,s);openBossBattle(rank)}
function ensureBattleUI(){let el=document.getElementById('bossBattleMode');if(el)return el;el=document.createElement('div');el.id='bossBattleMode';el.className='boss-battle-mode';el.innerHTML='<div class="bb-top"><div><span class="side-tag">SYSTEM • RANK TRIAL</span><h2 id="bbTitle">BOSS STAGE</h2></div><button id="bbExit">✕</button></div><div class="bb-hud"><span id="bbRank"></span><span id="bbAttempt"></span><span id="bbClock">00:00</span></div><div class="bb-hp"><div><span>BOSS HP</span><strong id="bbHpText">100 / 100</strong></div><div class="bb-hp-track"><i id="bbHpBar"></i></div></div><main class="bb-arena"><span id="bbCount" class="side-tag"></span><p id="bbFocus"></p><h1 id="bbObjective"></h1><div id="bbAttack" class="bb-attack"></div><div id="bbTimerPanel" class="bb-timer" hidden><strong id="bbTimer">00:00</strong><button id="bbTimerStart">START TIMER</button></div><button id="bbComplete" class="bb-main">COMPLETE OBJECTIVE</button><button id="bbEnd" class="bb-end">END ATTEMPT</button></main><div id="bbFlash" class="bb-flash"></div>';document.body.appendChild(el);document.getElementById('bbExit').onclick=closeBossBattle;return el}
function openBossBattle(rank){const el=ensureBattleUI();el.dataset.rank=rank;el.classList.add('active');document.body.classList.add('boss-mode-open');battleStartedAt=Date.now();clearInterval(bossClock);bossClock=setInterval(updateBattleClock,1000);renderBossBattle()}
function closeBossBattle(){clearInterval(bossClock);clearInterval(bossTimer);const el=document.getElementById('bossBattleMode');if(el)el.classList.remove('active');document.body.classList.remove('boss-mode-open');renderSideSystem()}
function updateBattleClock(){const e=document.getElementById('bbClock');if(!e)return;const n=Math.floor((Date.now()-battleStartedAt)/1000);e.textContent=fmt(n)}
function fmt(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function battleData(){const rank=document.getElementById('bossBattleMode')?.dataset.rank,b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem(),e=b?s.boss[rank]:null;if(!b||!e||e.activeVariant==null)return null;const v=b.variants[e.activeVariant],order=e.order||v.tasks.map((_,i)=>i),pos=Math.min(e.current||0,order.length-1);return{rank,b,s,e,v,order,obj:v.tasks[order[pos]]}}
function renderBossBattle(){const d=battleData();if(!d){closeBossBattle();return}const{rank,b,e,v,order,obj}=d,hp=Math.max(0,100-(e.damage||0));document.getElementById('bbTitle').textContent=v.name;document.getElementById('bbRank').textContent=rank+'-CLASS AT STAKE';document.getElementById('bbAttempt').textContent='ATTEMPT '+((e.attempts||0)+1);document.getElementById('bbHpText').textContent=hp+' / 100';document.getElementById('bbHpBar').style.width=hp+'%';document.getElementById('bbCount').textContent='OBJECTIVE '+((e.current||0)+1)+' / '+order.length+' REVEALED';document.getElementById('bbFocus').textContent=v.focus;document.getElementById('bbObjective').textContent=obj.text;document.getElementById('bbAttack').textContent=obj.attack+' • '+obj.damage+' DAMAGE';const panel=document.getElementById('bbTimerPanel'),complete=document.getElementById('bbComplete');clearInterval(bossTimer);if(obj.seconds){panel.hidden=false;document.getElementById('bbTimer').textContent=fmt(obj.seconds);document.getElementById('bbTimerStart').textContent='START TIMER';complete.disabled=true;document.getElementById('bbTimerStart').onclick=()=>runObjectiveTimer(obj.seconds)}else{panel.hidden=true;complete.disabled=false}complete.onclick=()=>completeBossObjective(rank);document.getElementById('bbEnd').onclick=()=>endBossAttempt(rank)}
function runObjectiveTimer(seconds){let left=seconds;const btn=document.getElementById('bbTimerStart'),out=document.getElementById('bbTimer'),complete=document.getElementById('bbComplete');btn.disabled=true;bossTimer=setInterval(()=>{left--;out.textContent=fmt(Math.max(0,left));if(left<=0){clearInterval(bossTimer);btn.textContent='TIMER COMPLETE';complete.disabled=false}},1000)}
function completeBossObjective(rank){const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e,v,order,obj}=d;e.damage=(e.damage||0)+obj.damage;e.checks=e.checks||[];e.checks[order[e.current||0]]=true;e.current=(e.current||0)+1;s.boss[rank]=e;saveSideSystem(s);showHit(obj);if(e.current>=order.length){setTimeout(()=>defeatBoss(rank),650)}else setTimeout(renderBossBattle,650)}
function showHit(obj){const f=document.getElementById('bbFlash');if(!f)return;f.textContent=obj.attack+'  -'+obj.damage+' HP';f.classList.remove('hit');void f.offsetWidth;f.classList.add('hit')}
function endBossAttempt(rank){const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e}=d,completed=(e.checks||[]).filter(Boolean).length,damage=e.damage||0;e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed,total:5,damage,date:new Date().toISOString(),passed:false});e.lastVariant=e.activeVariant;e.activeVariant=null;e.order=[];e.current=0;e.damage=0;e.checks=[];saveSideSystem(s);if(typeof addSystemMessage==='function')addSystemMessage('BOSS SURVIVED — '+completed+'/5 objectives • '+damage+' damage. Performance recorded.','quest');closeBossBattle();alert('BATTLE ENDED\n'+completed+'/5 OBJECTIVES\n'+damage+' DAMAGE DEALT\nBOSS SURVIVED\nNext attempt will change.')}
function defeatBoss(rank){const d=battleData();if(!d||d.rank!==rank)return;const{b,s,e}=d;e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed:5,total:5,damage:100,date:new Date().toISOString(),passed:true});e.lastVariant=e.activeVariant;e.activeVariant=null;e.order=[];e.current=0;e.damage=0;e.checks=[];e.passed=true;e.passedAt=new Date().toISOString();s.boss[rank]=e;saveSideSystem(s);if(typeof addXp==='function')addXp(b.reward,'boss-stage');if(typeof addSystemMessage==='function')addSystemMessage('BOSS DEFEATED! RANK PROMOTION: '+rank+'-CLASS — +'+b.reward+' XP','level');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();const el=ensureBattleUI();el.innerHTML='<div class="bb-victory"><span class="side-tag">SYSTEM ALERT</span><h1>BOSS DEFEATED</h1><p>RANK PROMOTION ACHIEVED</p><div class="bb-new-rank">'+rank+'-CLASS</div><strong>+'+b.reward+' XP</strong><button id="bbVictoryClose" class="bb-main">CONTINUE</button></div>';document.getElementById('bbVictoryClose').onclick=()=>{el.remove();document.body.classList.remove('boss-mode-open');renderSideSystem()}}
if(typeof getRank==='function'){const levelRank=getRank;getRank=function(level){const s=loadSideSystem(),c=currentClass(s);if(c==='E')return levelRank(Math.min(level,9));const b=BOSS_STAGES.find(x=>x.rank===c);return b?levelRank(b.level):levelRank(level)}}
function rankRewardSummary(rank){const r=RANK_REWARDS[rank]||RANK_REWARDS.E;return r.desc}
document.addEventListener('DOMContentLoaded',renderSideSystem);
