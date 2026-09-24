/* THE SYSTEM: Side Missions + Boss Stage rank tests */
const SIDE_SYSTEM_KEY='theSystemSideMissionsV1';
const SIDE_MISSIONS=[
 {id:'walk20',title:'Extra Mile',desc:'Walk for 20 minutes outside your scheduled workout.',xp:50},
 {id:'hydrate',title:'Hydration Mission',desc:'Hit your daily water target.',xp:25},
 {id:'protein',title:'Protein Protocol',desc:'Hit your daily protein target.',xp:25},
 {id:'core50',title:'Core Assault',desc:'Complete 50 total core reps.',xp:40},
 {id:'mobility',title:'Recovery Mission',desc:'Complete 10 minutes of stretching or mobility.',xp:30},
 {id:'weekend',title:'Weekend Warrior',desc:'Complete an extra Saturday or Sunday workout.',xp:75}
];
const BOSS_STAGES=[
 {rank:'D',level:10,title:'D-Rank Promotion',reward:250,tasks:['20 bodyweight squats','10 push-ups (modified allowed)','20 alternating lunges','30-second plank','10-minute walk or cardio']},
 {rank:'C',level:20,title:'C-Rank Promotion',reward:400,tasks:['30 squats','15 push-ups','24 alternating lunges','45-second plank','12-minute cardio']},
 {rank:'B',level:30,title:'B-Rank Promotion',reward:600,tasks:['40 squats','20 push-ups','30 alternating lunges','60-second plank','15-minute cardio']},
 {rank:'A',level:40,title:'A-Rank Promotion',reward:850,tasks:['50 squats','25 push-ups','36 alternating lunges','75-second plank','18-minute cardio']},
 {rank:'S',level:50,title:'S-Rank Promotion',reward:1200,tasks:['60 squats','30 push-ups','40 alternating lunges','90-second plank','20-minute cardio']},
 {rank:'S+',level:70,title:'National-Level Trial',reward:1600,tasks:['70 squats','35 push-ups','50 alternating lunges','2-minute plank','25-minute cardio']},
 {rank:'Shadow',level:90,title:'Sovereign Trial',reward:2500,tasks:['80 squats','40 push-ups','60 alternating lunges','2-minute plank','30-minute cardio']}
];
function sideToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function loadSideSystem(){let s={};try{s=JSON.parse(localStorage.getItem(SIDE_SYSTEM_KEY)||'{}')}catch(e){};if(s.date!==sideToday())s={...s,date:sideToday(),completed:[]};s.completed=s.completed||[];s.boss=s.boss||{};return s}
function saveSideSystem(s){localStorage.setItem(SIDE_SYSTEM_KEY,JSON.stringify(s))}
function currentClass(s){let c='E';for(const b of BOSS_STAGES)if(s.boss[b.rank]?.passed)c=b.rank;return c}
function renderSideSystem(){
 const root=document.getElementById('sideMissionSystem');if(!root)return;const s=loadSideSystem();
 const missions=document.getElementById('sideMissionList');
 missions.innerHTML=SIDE_MISSIONS.map(m=>'<article class="side-card '+(s.completed.includes(m.id)?'is-done':'')+'"><div><span class="side-tag">SIDE MISSION</span><h3>'+m.title+'</h3><p>'+m.desc+'</p></div><div class="side-reward">+'+m.xp+' XP</div><button type="button" data-side="'+m.id+'" '+(s.completed.includes(m.id)?'disabled':'')+'>'+(s.completed.includes(m.id)?'COMPLETE':'CLAIM COMPLETE')+'</button></article>').join('');
 missions.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>completeSideMission(b.dataset.side));
 const cls=currentClass(s);document.getElementById('currentRankClass').textContent=cls+'-CLASS';
 const bossWrap=document.getElementById('bossStageList');
 bossWrap.innerHTML=BOSS_STAGES.map(b=>{
   const passed=!!s.boss[b.rank]?.passed,eligible=(typeof state!=='undefined'?state.level:1)>=b.level;
   const checks=s.boss[b.rank]?.checks||[];
   return '<article class="boss-card '+(passed?'boss-passed':eligible?'boss-ready':'boss-locked')+'"><div class="boss-head"><div><span class="side-tag">'+(passed?'BOSS DEFEATED':eligible?'BOSS STAGE UNLOCKED':'LOCKED')+'</span><h3>'+b.title+'</h3><p>Requires Level '+b.level+' • Reward +'+b.reward+' XP</p></div><strong>'+b.rank+'</strong></div><div class="boss-tasks">'+b.tasks.map((t,i)=>'<label><input type="checkbox" data-boss="'+b.rank+'" data-task="'+i+'" '+(checks[i]?'checked':'')+' '+(!eligible||passed?'disabled':'')+'> '+t+'</label>').join('')+'</div><button type="button" data-defeat="'+b.rank+'" '+(!eligible||passed?'disabled':'')+'>'+(passed?'PROMOTION ACHIEVED':eligible?'DEFEAT BOSS':'REACH LEVEL '+b.level)+'</button></article>';
 }).join('');
 bossWrap.querySelectorAll('[data-boss]').forEach(x=>x.onchange=()=>saveBossCheck(x.dataset.boss,Number(x.dataset.task),x.checked));
 bossWrap.querySelectorAll('[data-defeat]').forEach(x=>x.onclick=()=>defeatBoss(x.dataset.defeat));
}
function completeSideMission(id){const s=loadSideSystem(),m=SIDE_MISSIONS.find(x=>x.id===id);if(!m||s.completed.includes(id))return;s.completed.push(id);saveSideSystem(s);if(typeof addXp==='function')addXp(m.xp,'side-mission');if(typeof addSystemMessage==='function')addSystemMessage('Side Mission Complete: '+m.title+' — +'+m.xp+' XP','quest');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem()}
function saveBossCheck(rank,i,on){const s=loadSideSystem();s.boss[rank]=s.boss[rank]||{checks:[]};s.boss[rank].checks[i]=on;saveSideSystem(s)}
function defeatBoss(rank){const b=BOSS_STAGES.find(x=>x.rank===rank),s=loadSideSystem();if(!b||(typeof state!=='undefined'?state.level:1)<b.level)return;const entry=s.boss[rank]||{checks:[]};if(entry.checks.filter(Boolean).length<b.tasks.length){alert('Complete every Boss Stage requirement before claiming the promotion.');return}entry.passed=true;entry.passedAt=new Date().toISOString();s.boss[rank]=entry;saveSideSystem(s);if(typeof addXp==='function')addXp(b.reward,'boss-stage');if(typeof addSystemMessage==='function')addSystemMessage('BOSS DEFEATED! '+b.title+' complete — '+rank+'-Class unlocked.','level');if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderSideSystem()}
document.addEventListener('DOMContentLoaded',renderSideSystem);
