/* Offline movement diagrams and an optional, replayable first-run tutorial. */
(() => {
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Each pose: head, torso (shoulder to hip), arms and legs; side-view schematics.
const poses={
 stand:[[65,20],[65,36,65,79],[65,40,55,60,55,77],[65,40,75,60,75,77],[65,79,53,103,50,124],[65,79,77,103,80,124]],
 squat:[[48,42],[49,57,68,83],[49,59,30,62,18,62],[49,59,36,66,22,66],[68,83,40,98,50,124],[68,83,82,99,82,124]],
 lunge:[[62,25],[62,41,62,78],[62,45,48,58,44,76],[62,45,75,58,78,76],[62,78,32,90,32,124],[62,78,85,103,105,124]],
 push:[[25,64],[38,73,85,90],[38,73,35,96,36,124],[38,73,46,98,48,124],[85,90,104,107,123,124],[85,90,102,107,119,124]],
 pushLow:[[24,92],[38,99,88,110],[38,99,58,112,36,124],[38,99,62,115,48,124],[88,110,106,117,123,124],[88,110,103,117,119,124]],
 incline:[[24,38],[38,48,83,84],[38,48,25,64,25,83],[38,48,37,64,37,83],[83,84,100,105,115,124],[83,84,98,105,110,124]],
 inclineLow:[[18,54],[31,65,78,90],[31,65,45,74,25,83],[31,65,50,78,37,83],[78,90,99,107,115,124],[78,90,96,107,110,124]],
 hipLow:[[20,81],[33,90,75,117],[33,90,48,106,70,113],[33,90,48,106,70,113],[75,117,100,99,114,124],[75,117,96,99,110,124]],
 hip:[[20,81],[33,90,75,90],[33,90,48,98,70,96],[33,90,48,98,70,96],[75,90,100,94,114,124],[75,90,96,94,110,124]],
 bridgeLow:[[19,112],[32,120,70,120],[32,120,45,124,62,124],[32,120,45,124,60,124],[70,120,91,95,112,124],[70,120,94,98,116,124]],
 bridge:[[19,112],[32,120,70,96],[32,120,45,124,62,124],[32,120,45,124,60,124],[70,96,92,94,112,124],[70,96,95,98,116,124]],
 plank:[[25,65],[38,76,86,94],[38,76,38,113,60,124],[38,76,43,113,64,124],[86,94,105,109,123,124],[86,94,103,110,119,124]],
 climber:[[25,64],[38,73,85,90],[38,73,35,96,36,124],[38,73,46,98,48,124],[85,90,57,103,78,124],[85,90,102,107,119,124]],
 knee:[[65,20],[65,36,65,79],[65,40,45,52,53,36],[65,40,78,54,85,68],[65,79,35,77,40,103],[65,79,77,103,80,124]],
 rowLow:[[34,40],[47,48,77,78],[47,48,42,75,42,99],[47,48,54,75,54,99],[77,78,64,102,59,124],[77,78,93,102,98,124]],
 row:[[34,40],[47,48,77,78],[47,48,67,65,40,67],[47,48,75,70,52,72],[77,78,64,102,59,124],[77,78,93,102,98,124]],
 overheadLow:[[65,39],[65,55,65,87],[65,58,40,66,40,43],[65,58,90,66,90,43],[65,87,53,105,50,124],[65,87,77,105,80,124]],
 overhead:[[65,39],[65,55,65,87],[65,58,48,36,48,12],[65,58,82,36,82,12],[65,87,53,105,50,124],[65,87,77,105,80,124]],
 curl:[[65,20],[65,36,65,79],[65,40,52,62,42,44],[65,40,78,62,88,44],[65,79,53,103,50,124],[65,79,77,103,80,124]],
 extension:[[65,39],[65,55,65,87],[65,58,48,24,62,48],[65,58,82,24,68,48],[65,87,53,105,50,124],[65,87,77,105,80,124]],
 benchLow:[[20,81],[33,90,83,90],[33,90,60,90,60,68],[33,90,49,90,49,68],[83,90,105,104,105,124],[83,90,94,104,94,124]],
 bench:[[20,81],[33,90,83,90],[33,90,38,64,38,32],[33,90,50,64,50,32],[83,90,105,104,105,124],[83,90,94,104,94,124]],
 chestLow:[[65,20],[65,36,65,79],[65,40,84,49,57,48],[65,40,88,53,61,52],[65,79,53,103,50,124],[65,79,77,103,80,124]],
 chest:[[65,20],[65,36,65,79],[65,40,40,45,15,45],[65,40,40,52,15,52],[65,79,53,103,50,124],[65,79,77,103,80,124]],
 stretch:[[65,20],[65,36,65,79],[65,40,43,39,19,39],[65,40,40,55,39,34],[65,79,53,103,50,124],[65,79,77,103,80,124]]
};
function figure(pose,label,prop=''){
 const p=poses[pose];return '<figure><svg viewBox="0 0 140 142" role="img" aria-label="'+esc(label)+'"><path d="M8 130H132" stroke="#32566b"/>'+prop+'<g fill="none" stroke="#83efff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="'+p[0][0]+'" cy="'+p[0][1]+'" r="9"/>'+p.slice(1).map(points=>'<polyline points="'+points.join(' ')+'"/>').join('')+'</g></svg><figcaption>'+esc(label)+'</figcaption></figure>';
}
const benchProp='<path d="M15 101H89M30 101V129M80 101V129" fill="none" stroke="#a791ff" stroke-width="4"/>';
const inclineProp='<path d="M12 88H46M20 88V129M40 88V129" fill="none" stroke="#a791ff" stroke-width="4"/>';
const guides=[
 [/^incline push-ups?$/i,'incline','inclineLow',['Brace against a stable raised surface.','Bend elbows and lower your chest toward the surface.','Press back up, keeping your body in one line.'],inclineProp],
 [/^(push-ups?|standard push-ups?)$/i,'push','pushLow',['Hands just wider than shoulders; brace your middle.','Lower chest with elbows angled back.','Push the floor away; keep hips aligned.']],
 [/^(bodyweight squats?|squats?|goblet squat|barbell squat|band squat)$/i,'stand','squat',['Stand with feet about shoulder-width apart.','Bend hips and knees to a comfortable depth.','Keep heels grounded and stand with control.']],
 [/^(dumbbell )?reverse lunges?$/i,'stand','lunge',['Stand tall, then step one foot backward.','Lower both knees while keeping the front foot planted.','Push through the front foot to stand; alternate sides.']],
 [/^(dumbbell |band )?glute bridge$/i,'bridgeLow','bridge',['Lie on your back with knees bent and feet flat.','Lift hips by squeezing your glutes; avoid arching your back.','Lower slowly. Keep any load secure across your hips.']],
 [/^barbell hip thrust$/i,'hipLow','hip',['Rest your upper back on a stable bench; secure the padded bar at your hips.','Drive through planted feet until your hips are extended.','Keep ribs down and lower with control.'],benchProp],
 [/^plank$/i,'plank','plank',['Set elbows beneath shoulders and extend your legs.','Brace your abdomen; keep head, hips and heels aligned.','Hold while breathing; end the set if your hips sag.']],
 [/^mountain climbers$/i,'push','climber',['Start in a high plank with hands under shoulders.','Bring one knee toward your chest without lifting your hips.','Return the foot and alternate at a controlled pace.']],
 [/^(high knees|march in place|brisk walk|cardio)$/i,'stand','knee',['Stay tall and keep your steps controlled.','Alternate legs and swing arms naturally.','For high knees, lift toward hip height; for walking or marching, use a comfortable lift.']],
 [/^(dumbbell rows?|rows?)$/i,'rowLow','row',['Hinge at your hips with knees soft and back steady.','Pull elbows toward your hips without twisting.','Lower the weight slowly; keep your neck aligned.']],
 [/^shoulder press$/i,'overheadLow','overhead',['Start with weights near shoulder height.','Brace your middle and press overhead without leaning back.','Lower slowly to the starting position.']],
 [/^biceps curls$/i,'stand','curl',['Keep elbows close to your sides.','Bend elbows to lift the weights without swinging.','Lower slowly; keep your wrists straight.']],
 [/^triceps extensions$/i,'extension','overhead',['Hold a manageable weight securely above your head.','Bend elbows to lower it behind your head.','Keep upper arms steady and extend elbows with control.']],
 [/^(dumbbell press|barbell bench press)$/i,'benchLow','bench',['Lie on a stable bench with feet planted.','Lower the weight toward your chest with wrists over elbows.','Press upward with control; use safeties or a spotter for a barbell.'],benchProp],
 [/^band chest press$/i,'chestLow','chest',['Anchor the band securely behind you at chest height.','Stand with a stable stance and press your hands forward.','Return slowly without letting the band pull you backward.']],
 [/^stretching$/i,'stand','stretch',['Choose a comfortable stretch for the muscles trained.','Ease into the position without bouncing or forcing it.','Breathe normally and stay within a pain-free range.']]
];
// Progression variations carry explicit instructions; no mismatched generic diagrams.
const progressionCues={
 push:['Use the named support: wall, stable incline, knees, or toes. Keep shoulders, hips and supporting knees/heels aligned.','Lower with control. Paused variation: hold one second near the bottom; slow variation: lower for three seconds.','Press up without letting your hips sag. Stop if you cannot keep your chosen form.'],
 squat:['For supported squats, hold a stable support lightly. Keep your feet planted.','Sit hips back and bend knees within a comfortable range. Paused: hold one second; tempo: lower for three seconds.','Stand without bouncing or using momentum.'],
 lunge:['Use a stable support when prescribed. Step backward for reverse lunges or forward for walking lunges.','Lower with your front foot planted. For paused lunges, hold briefly at the bottom.','Push through the front leg and return under control before the next repetition.'],
 pull:['Lie face down, with your neck aligned and elbows bent into a W.','Lift hands and elbows gently without arching your lower back. For holds, maintain that position while breathing.','For W-to-Y raises, reach your arms diagonally overhead, then return to W under control.'],
 hinge:['Lie on your back with knees bent and feet planted. Lift hips without arching your back.','Paused: hold the top briefly. Marching: lift one foot at a time while keeping your pelvis level.','Single-leg: extend one leg and drive through the planted foot. Lower with control.'],
 core:['Lie on your back and brace your abdomen gently. Keep your lower back from arching.','Heel tap: from hips and knees bent, lower one heel to the floor. Long lever: extend the opposite arm and leg farther away.','Bring limbs back under control. Reduce reach if your back lifts.'],
 plank:['Use a stable raised surface, knees, or toes as named. Keep your body aligned and breathe.','For shoulder taps, use a high plank with hands beneath shoulders and a slightly wider foot position.','Touch one hand to the opposite shoulder without rocking your hips; alternate sides.'],
 cardio:['Stay upright, with clear space around you. Start with controlled marching.','Brisk marching increases the stepping pace. For low-impact jogging, use short, gentle steps with minimal bounce.','For jogging intervals, jog during the work timer and recover during rest. Step back to marching if impact feels uncomfortable.'],
 walk:['Walk upright at a purposeful, comfortable pace.','For walking intervals, alternate the faster work segment with an easy recovery segment.','Keep both work and recovery controlled. The app provides the interval timing.'],
 burpee:['Use a stable raised surface for elevated burpees; otherwise place hands on the floor and brace your middle.','Step back and in for step-back variations. For burpees, move into a plank, bring feet back toward hands, then stand.','Only the push-up variation adds a controlled push-up. A jump is optional; begin each trial without jumping.'],
 climber:['Use a stable raised surface for elevated climbers, or the floor for other variations.','Bring one knee toward your chest, return it, and alternate while keeping hips steady.','Slow climbers use deliberate steps. Increase pace only while your shoulders and hips stay controlled.']
};
progressionCues.knees=progressionCues.cardio;
for(const family of ['bandChest','bandRow','bandSquat','bandBridge'])progressionCues[family]=['Secure the band and any anchor before starting. Keep tension controlled throughout the named press, row, squat or bridge.','For paused variations, briefly hold the working position. For tempo variations, return slowly over three seconds.','Keep your body stable. Use a lighter band if you cannot maintain control; do not estimate band resistance as a barbell weight.'];
if(window.SystemMovementProgression)for(const [family,items] of Object.entries(window.SystemMovementProgression.ladders))for(const item of items){if(!guides.some(g=>g[0].test(item.name)))guides.push([new RegExp('^'+item.name+'$','i'),null,null,progressionCues[family]]);}
function lookup(name){return guides.find(g=>g[0].test(name))||null}
let lastFocus;
function close(id){document.getElementById(id)?.classList.remove('active');lastFocus?.focus()}
function panel(id,title,body,actions){let el=document.getElementById(id);if(!el){el=document.createElement('div');el.id=id;el.className='system-onboarding system-help';document.body.appendChild(el)}el.innerHTML='<section class="system-help__card" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="system-help__body">'+body+'</div><footer>'+actions+'</footer></section>';el.classList.add('active');return el}
function openGuide(){
 const name=document.getElementById('liveExerciseName')?.textContent||'',g=lookup(name);lastFocus=document.activeElement;
 const visual=g&&g[1]?'<div class="exercise-poses">'+figure(g[1],g[1]===g[2]?'HOLD':'START',g[4]||'')+'<span aria-hidden="true">→</span>'+figure(g[2],g[1]===g[2]?'KEEP ALIGNED':'MOVEMENT',g[4]||'')+'</div>':'';
 const cues=g?g[3]:['A movement diagram is not available for this exercise yet.','Follow the instructions for your specific equipment or ask a qualified trainer.'];
 const el=panel('exerciseGuide',name,'<small>EXERCISE GUIDE // CURRENT SET</small><h2>'+esc(name)+'</h2><div class="exercise-guide-layout">'+visual+'<div><p class="guide-note">'+(g?(g[1]?'Movement schematic • match your prescribed equipment.':'Movement instructions • follow the named variation.'):'Custom exercise or equipment-specific movement.')+'</p><ol>'+cues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><p class="guide-note">Automatic exercise progression pauses when you open this guide. Resume when ready.</p></div></div>','<button id="closeExerciseGuide" type="button">BACK TO WORKOUT</button>');
 el.querySelector('button').onclick=()=>close('exerciseGuide');el.querySelector('button').focus();
}
window.SystemExerciseGuide={open:openGuide,lookup:name=>!!lookup(name),render:name=>{const b=document.getElementById('openExerciseGuide');if(b){b.textContent='VIEW MOVEMENT GUIDE';b.setAttribute('aria-label','View movement guide for '+name)}const preview=document.getElementById('liveMovementPreview'),g=lookup(name);if(preview){preview.innerHTML=g&&g[1]?figure(g[1],'START',g[4]||'')+figure(g[2],g[1]===g[2]?'HOLD':'MOVE',g[4]||'')+'<p>'+esc(g[3][0])+'</p>':'<p>Open the movement guide for exercise instructions.</p>'}document.getElementById('exerciseGuide')?.classList.remove('active')}};
const steps=[
 ['WELCOME TO THE SYSTEM','Your first mission is learning the controls.','Your profile sets your training path, equipment and weekly schedule. The Awakening Assessment establishes your starting level and Class.','PROFILE → ASSESSMENT → CENTRAL COMMAND',['SET YOUR PATH','COMPLETE ASSESSMENT','BEGIN TRAINING']],
 ['CENTRAL COMMAND','Your home base at a glance.','Player Status shows level, Class and XP. System Analysis shows attributes and a development priority. Daily Sync shows today’s side-objective completion.','YOUR DAILY DASHBOARD',['PLAYER STATUS','TODAY’S MISSION','SYSTEM ANALYSIS']],
 ['CHOOSE TODAY’S MISSION','Check the plan before you start.','Tap Begin Mission to review your workout. You can choose Bodyweight or Gym for this session before starting; the choice locks once the session begins.','BEGIN MISSION → REVIEW → LAUNCH',['BODYWEIGHT / GYM','REVIEW EXERCISES','LAUNCH MISSION']],
 ['FOLLOW THE WORKOUT','Start once per exercise.','Tap Start Exercise to run sets and rests automatically. Pause or add time whenever needed. Confirm your actual results at the end; the next exercise waits for Start. Controlled form and effort feedback help unlock harder variations.','START → WORK / REST → CONFIRM',['PAUSE / EXTEND','CONFIRM RESULTS','EARN VARIATIONS']],
 ['READ YOUR RESULTS','See what you accomplished.','The mission report shows XP, training time, personal records and your session performance grade. That grade is separate from your player Class. Return to Central Command when finished.','WORKOUT GRADE ≠ PLAYER CLASS',['XP EARNED','PERSONAL RECORDS','RETURN TO COMMAND']],
 ['SIDE MISSIONS & BOSSES','Develop your build over time.','Open Training for optional Side Missions, Boss Stage, and the Exercise Library. Boss Stage shows promotion requirements and trials. Earned level unlocks an attempt; your Class advances when its requirements and trial are cleared.','CONSISTENCY → DEVELOPMENT → PROMOTION',['SIDE MISSIONS','BOSS REQUIREMENTS','PROMOTION TRIAL']],
 ['PROGRESS & HEALTH','Compare against your starting point.','Progress holds your assessment baseline and training history. Health Connect is optional: connect it in Health to read supported watch data. Daily steps are separate from your endurance assessment score.','BASELINE + HISTORY + OPTIONAL HEALTH',['ASSESSMENT BASELINE','WORKOUT HISTORY','HEALTH CONNECT']],
 ['YOU’RE READY','Help is always available.','Replay this tutorial from Profile & Settings. Use Account & Data to export or import a backup. Check cloud backup status before changing devices. Start with today’s mission and log what you actually complete.','PROFILE & SETTINGS → REPLAY APP TUTORIAL',['REPLAY TUTORIAL','BACK UP PROGRESS','START YOUR MISSION']]
];
function readOnboarding(){try{return JSON.parse(localStorage.getItem('systemOnboardingV2')||'null')}catch(_){return null}}
function saveTutorial(status){const ob=readOnboarding();if(ob)localStorage.setItem('systemOnboardingV2',JSON.stringify({...ob,tutorialPending:false,tutorial:{version:1,status,at:new Date().toISOString()}}))}
function showTutorial(){
 lastFocus=document.activeElement;let index=0;
 function finish(status){saveTutorial(status);close('systemTutorial')}
 function render(){const s=steps[index];const el=panel('systemTutorial','App tutorial','<small>THE SYSTEM // QUICK START '+(index+1)+' / '+steps.length+'</small><h2>'+s[0]+'</h2><p class="tutorial-lead">'+s[1]+'</p><div class="tutorial-tiles">'+s[4].map((x,i)=>'<div><b>0'+(i+1)+'</b><span>'+x+'</span></div>').join('')+'</div><p>'+s[2]+'</p><p class="tutorial-route">'+s[3]+'</p>','<button id="skipSystemTutorial" type="button">SKIP TUTORIAL</button><button id="backSystemTutorial" type="button" '+(index?'':'disabled')+'>BACK</button><button id="nextSystemTutorial" type="button">'+(index===steps.length-1?'FINISH':'NEXT')+'</button>');el.querySelector('#skipSystemTutorial').onclick=()=>finish('skipped');el.querySelector('#backSystemTutorial').onclick=()=>{index--;render()};el.querySelector('#nextSystemTutorial').onclick=()=>{if(index===steps.length-1)finish('completed');else{index++;render()}};el.querySelector('#nextSystemTutorial').focus()}
 render();
}
function offerTutorial(){const ob=readOnboarding();if(ob&&(ob.tutorialPending||!ob.tutorial)&&!ob.assessmentPending&&localStorage.getItem('systemAwakeningAssessmentV1')&&!document.querySelector('#systemTutorial.active'))showTutorial()}
window.SystemTutorial={show:showTutorial,offer:offerTutorial};
document.addEventListener('keydown',e=>{const el=document.querySelector('#exerciseGuide.active,#systemTutorial.active');if(!el)return;if(e.key==='Escape'){e.preventDefault();if(el.id==='systemTutorial')saveTutorial('skipped');close(el.id)}if(e.key==='Tab'){const nodes=[...el.querySelectorAll('button:not(:disabled)')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('openExerciseGuide')?.addEventListener('click',openGuide);document.addEventListener('click',e=>{if(e.target.closest('[data-replay-tutorial]'))showTutorial()});setTimeout(offerTutorial,500);setInterval(()=>{if(!document.querySelector('.system-onboarding.active,#authGate:not([hidden]),#systemEntryScreen:not([hidden])'))offerTutorial()},1500)});
})();
