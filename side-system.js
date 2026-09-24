/* THE SYSTEM: Side Missions + Adaptive Boss Rank Trials */
const SIDE_SYSTEM_KEY='systemMission:sideBossV2';
const SIDE_MISSIONS=[
 {id:'walk20',title:'Extra Mile',desc:'Walk for 20 minutes outside your scheduled workout.',xp:50},
 {id:'hydrate',title:'Hydration Mission',desc:'Hit your daily water target.',xp:25},
 {id:'protein',title:'Protein Protocol',desc:'Hit your daily protein target.',xp:25},
 {id:'core50',title:'Core Assault',desc:'Complete 50 total core reps.',xp:40},
 {id:'mobility',title:'Recovery Mission',desc:'Complete 10 minutes of stretching or mobility.',xp:30},
 {id:'weekend',title:'Weekend Warrior',desc:'Complete an extra Saturday or Sunday workout.',xp:75}
];
const BOSS_STAGES=[
 {rank:'D',level:10,title:'D-Rank Promotion',reward:250,variants:[
  {name:'Strength Trial',focus:'Full Body / Strength',time:'18–25 min',tasks:['20 bodyweight squats','10 push-ups (modified allowed)','20 alternating lunges','30-second plank','10-minute walk or cardio']},
  {name:'Endurance Trial',focus:'Endurance',time:'20–28 min',tasks:['15 bodyweight squats','8 push-ups (modified allowed)','30 step-ups','45-second plank','12-minute brisk walk']},
  {name:'Full Body Trial',focus:'Full Body',time:'18–25 min',tasks:['20 chair squats','12 incline push-ups','20 reverse lunges','10 glute bridges','10-minute cardio']},
  {name:'System Circuit',focus:'Circuit / Conditioning',time:'18–24 min',tasks:['3 rounds: 10 squats','3 rounds: 5 push-ups','3 rounds: 10 alternating lunges','3 rounds: 20-second plank','5-minute cardio finisher']}
 ]},
 {rank:'C',level:20,title:'C-Rank Promotion',reward:400,variants:makeVariants(30,15,24,45,12)},
 {rank:'B',level:30,title:'B-Rank Promotion',reward:600,variants:makeVariants(40,20,30,60,15)},
 {rank:'A',level:40,title:'A-Rank Promotion',reward:850,variants:makeVariants(50,25,36,75,18)},
 {rank:'S',level:50,title:'S-Rank Promotion',reward:1200,variants:makeVariants(60,30,40,90,20)},
 {rank:'S+',level:70,title:'National-Level Trial',reward:1600,variants:makeVariants(70,35,50,120,25)},
 {rank:'Shadow',level:90,title:'Sovereign Trial',reward:2500,variants:makeVariants(80,40,60,120,30)}
];
function makeVariants(sq,pu,lu,pl,cardio){return[
 {name:'Strength Trial',focus:'Strength / Core',time:(cardio+10)+'–'+(cardio+18)+' min',tasks:[sq+' squats',pu+' push-ups',lu+' alternating lunges',pl+'-second plank',cardio+'-minute cardio']},
 {name:'Endurance Trial',focus:'Endurance / Conditioning',time:(cardio+12)+'–'+(cardio+20)+' min',tasks:[Math.max(10,sq-5)+' squats',Math.max(5,pu-3)+' push-ups',(lu+6)+' step-ups',Math.round(pl*1.15)+'-second plank',(cardio+3)+'-minute cardio']},
 {name:'Full Body Trial',focus:'Full Body / Control',time:(cardio+10)+'–'+(cardio+18)+' min',tasks:[sq+' chair or bodyweight squats',pu+' incline or standard push-ups',lu+' reverse lunges',Math.max(10,Math.round(sq/2))+' glute bridges',cardio+'-minute cardio']},
 {name:'System Circuit',focus:'Circuit / Conditioning',time:(cardio+8)+'–'+(cardio+16)+' min',tasks:['3 rounds: '+Math.ceil(sq/3)+' squats','3 rounds: '+Math.ceil(pu/3)+' push-ups','3 rounds: '+Math.ceil(lu/3)+' alternating lunges','3 rounds: '+Math.ceil(pl/3)+'-second plank',Math.max(5,cardio-5)+'-minute cardio finisher']}
]}
function sideToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function loadSideSystem(){let s={};try{s=JSON.parse(localStorage.getItem(SIDE_SYSTEM_KEY)||'{}')}catch(e){};if(s.date!==sideToday())s={...s,date:sideToday(),completed:[]};s.completed=s.completed||[];s.boss=s.boss||{};return s}
function saveSideSystem(s){localStorage.setItem(SIDE_SYSTEM_KEY,JSON.stringify(s))}
function currentClass(s){let c='E';for(const b of BOSS_STAGES)if(s.boss[b.rank]?.passed)c=b.rank;return c}
function bossIndex(rank){return BOSS_STAGES.findIndex(b=>b.rank===rank)}
function bossEligible(b,s){const i=bossIndex(b.rank),level=(typeof state!=='undefined'?state.level:1);return level>=b.level&&(i===0||!!s.boss[BOSS_STAGES[i-1].rank]?.passed)}
function chooseVariant(b,entry){const count=b.variants.length;if(count<2)return 0;let next=Math.floor(Math.random()*count);if(next===entry.lastVariant)next=(next+1+Math.floor(Math.random()*(count-1)))%count;return next}
function ensureAttempt(b,s){const e=s.boss[b.rank]||{attempts:0,history:[]};if(e.activeVariant==null){e.activeVariant=chooseVariant(b,e);e.checks=[];e.startedAt=new Date().toISOString()}e.history=e.history||[];s.boss[b.rank]=e;saveSideSystem(s);return e}
function renderSideSystem(){
 const root=document.getElementById('sideMissionSystem');if(!root)return;const s=loadSideSystem();
 const missions=document.getElementById('sideMissionList');
 missions.innerHTML=SIDE_MISSIONS.map(m=>'<article class="side-card '+(s.completed.includes(m.id)?'is-done':'')+'"><div><span class="side-tag">SIDE MISSION</span><h3>'+m.title+'</h3><p>'+m.desc+'</p></div><div class="side-reward">+'+m.xp+' XP</div><button type="button" data-side="'+m.id+'" '+(s.completed.includes(m.id)?'disabled':'')+'>'+(s.completed.includes(m.id)?'COMPLETE':'CLAIM COMPLETE')+'</button></article>').join('');
 missions.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>completeSideMission(b.dataset.side));
 document.getElementById('currentRankClass').textContent=currentClass(s)+'-CLASS';
 const wrap=document.getElementById('bossStageList');
 wrap.innerHTML=BOSS_STAGES.map(b=>{const e=s.boss[b.rank]||{attempts:0,history:[]},passed=!!e.passed,eligible=bossEligible(b,s),active=e.activeVariant!=null?b.variants[e.activeVariant]:null,best=(e.history||[]).reduce((m,x)=>Math.max(m,x.completed||0),0);
  if(passed)return '<article class="boss-card boss-passed"><div class="boss-head"><div><span class="side-tag">BOSS DEFEATED</span><h3>'+b.title+'</h3><p>Promotion achieved • +'+b.reward+' XP</p></div><strong>'+b.rank+'</strong></div><button disabled>PROMOTION ACHIEVED</button></article>';
  if(!eligible)return '<article class="boss-card boss-locked"><div class="boss-head"><div><span class="side-tag">LOCKED</span><h3>'+b.title+'</h3><p>Requires Level '+b.level+(bossIndex(b.rank)>0?' and previous rank promotion':'')+'</p></div><strong>'+b.rank+'</strong></div><button disabled>LOCKED</button></article>';
  if(!active)return '<article class="boss-card boss-ready"><div class="boss-head"><div><span class="side-tag">BOSS INTEL</span><h3>'+b.title+'</h3><p>Level '+b.level+' • +'+b.reward+' XP • '+b.variants.length+' possible trials</p><p>Previous Attempts: '+(e.attempts||0)+' • Best Result: '+best+'/5</p></div><strong>'+b.rank+'</strong></div><button type="button" data-start="'+b.rank+'">BEGIN RANK TRIAL</button></article>';
  return '<article class="boss-card boss-ready"><div class="boss-head"><div><span class="side-tag">ACTIVE BOSS: '+active.name+'</span><h3>'+b.title+'</h3><p>'+active.focus+' • '+active.time+' • Attempt '+((e.attempts||0)+1)+'</p></div><strong>'+b.rank+'</strong></div><div class="boss-tasks">'+active.tasks.map((t,i)=>'<label><input type="checkbox" data-boss="'+b.rank+'" data-task="'+i+'" '+(e.checks?.[i]?'checked':'')+'> '+t+'</label>').join('')+'</div><div class="boss-actions"><button type="button" data-defeat="'+b.rank+'">DEFEAT BOSS</button><button type="button" data-end="'+b.rank+'">END ATTEMPT</button></div></article>';
 }).join('');
 wrap.querySelectorAll('[data-start]').forEach(x=>x.onclick=()=>startBoss(x.dataset.start));
 wrap.querySelectorAll('[data-boss]').forEach(x=>x.onchange=()=>saveBossCheck(x.dataset.boss,Number(x.dataset.task),x.checked));
 wrap.querySelectorAll('[data-defeat]').forEach(x=>x.onclick=()=>defeatBoss(x.dataset.defeat));
 wrap.querySelectorAll('[data-end]').forEach(x=>x.onclick=()=>endBossAttempt(x.dataset.end));
}
function startBoss(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem();if(!b||!bossEligible(b,s))return;ensureAttempt(b,s);renderSideSystem()}
function completeSideMission(id){const s=loadSideSystem(),m=SIDE_MISSIONS.find(x=>x.id===id);if(!m||s.completed.includes(id))return;s.completed.push(id);saveSideSystem(s);if(typeof addXp==='function')addXp(m.xp,'side-mission');if(typeof addSystemMessage==='function')addSystemMessage('Side Mission Complete: '+m.title+' — +'+m.xp+' XP','quest');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem()}
function saveBossCheck(rank,i,on){const s=loadSideSystem(),b=BOSS_STAGES.find(x=>x.rank===rank);if(!b)return;const e=ensureAttempt(b,s);e.checks[i]=on;s.boss[rank]=e;saveSideSystem(s)}
function endBossAttempt(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem(),e=s.boss[rank];if(!b||!e||e.activeVariant==null)return;const completed=(e.checks||[]).filter(Boolean).length;e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed,total:b.variants[e.activeVariant].tasks.length,date:new Date().toISOString(),passed:false});e.lastVariant=e.activeVariant;e.activeVariant=null;e.checks=[];saveSideSystem(s);if(typeof addSystemMessage==='function')addSystemMessage('BOSS BATTLE ENDED — '+completed+'/5 objectives complete. Next attempt will change.','quest');renderSideSystem()}
function defeatBoss(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem(),e=s.boss[rank];if(!b||!e||e.activeVariant==null)return;const total=b.variants[e.activeVariant].tasks.length,completed=(e.checks||[]).filter(Boolean).length;if(completed<total){endBossAttempt(rank);alert('RANK PROMOTION FAILED\n'+completed+'/'+total+' objectives completed.\nYour rank remains '+currentClass(s)+'-Class.\nThe next Boss Trial will be different.');return}e.attempts=(e.attempts||0)+1;e.history=e.history||[];e.history.push({variant:e.activeVariant,completed,total,date:new Date().toISOString(),passed:true});e.lastVariant=e.activeVariant;e.activeVariant=null;e.checks=[];e.passed=true;e.passedAt=new Date().toISOString();s.boss[rank]=e;saveSideSystem(s);if(typeof addXp==='function')addXp(b.reward,'boss-stage');if(typeof addSystemMessage==='function')addSystemMessage('BOSS DEFEATED! RANK PROMOTION: '+rank+'-CLASS — +'+b.reward+' XP','level');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem();alert('BOSS DEFEATED\nRANK PROMOTION ACHIEVED\n'+rank+'-CLASS\n+'+b.reward+' XP')}
if(typeof getRank==='function'){const levelRank=getRank;getRank=function(level){const natural=levelRank(level),s=loadSideSystem(),c=currentClass(s);if(c==='E')return levelRank(Math.min(level,9));const b=BOSS_STAGES.find(x=>x.rank===c);return b?levelRank(b.level):natural}}
document.addEventListener('DOMContentLoaded',renderSideSystem);
