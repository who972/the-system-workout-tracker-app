/* Focused local assistant: no network calls, stored transcripts, or generated claims. */
(function(root){
'use strict';
const COMMAND_GUIDE=[
 ['Training','What is my workout today?','Start my workout','Resume my session','Switch today to gym','Use bodyweight today','I only have 15 minutes','Show the full session','Replace this exercise','What weight should I use?','What did I lift last time?'],
 ['Custom training','Create a custom workout','Can I do a custom exercise?','Open my saved workouts','I want to walk for 15 minutes','Set up a stretching session','Help me log a bike ride','Open the exercise library','Find dumbbell exercises'],
 ['During a workout','Show proper form','I did 10 reps at 25 pounds','I had two reps left','Start the timer','Pause the timer','How many sets are left?','Skip the rest timer','That was too hard','This movement hurts','Finish my workout','Save my progress for later'],
 ['Plan and progress','Open my training plan','Change to hybrid training','Change my available equipment','Change my fitness goal','I can train three days a week','Show my training schedule','I missed yesterday','Show my assessment results','Show my personal records','Compare my recent workouts','How close am I to leveling up?','Open my achievements','Show my streak','Show side missions','Open Boss Stage'],
 ['Health and fuel','Open my health data','How many steps today?','When did my watch last sync?','How did I sleep?','Show my sleep history','Give me my recovery briefing','I am tired today','My muscles are sore','Log 16 ounces of water','How much water have I logged?','Open my food log'],
 ['Social and settings','Open Train Together','Host a workout','Join a workout','Show my friends','Open my squad','Show squad progress','Read my alerts','Give me today’s briefing','Open my profile','Change my units','Open sound settings','Back up my progress','Open import options','Show the tutorial'],
 ['Voice controls','Stop speaking','Repeat that','Mute spoken replies','Unmute spoken replies','Close the assistant','Never mind']
];
const ROUTES=[
 [/custom exercise|add (?:an? )?exercise/,'exercise','libraryExerciseForm'],
 [/custom (?:workout|training|mission)|choose my exercises/,'missions','workoutBuilder'],
 [/saved (?:workout|mission)/,'missions','savedWorkouts'],
 [/exercise (?:library|database)|find .+exercises|show .+exercises/,'exercise','exerciseLibrary'],
 [/assessment|starting rank|where have i improved/,'progress','assessmentBaselineCard'],
 [/personal records/,'progress','personalRecords'],
 [/achievement|what did i unlock/,'achievements','achievementGrid'],
 [/side mission/,'side','sideMissionSystem'],[/boss|promotion requirements|next rank/,'boss','bossStageSystem'],
 [/training plan|hybrid|available equipment|fitness goal|training schedule|days a week|missed yesterday|adjust my schedule|movement restrictions/,'profile','trainingProfileForm'],
 [/sleep history/,'telemetry','.system-sleep-tracker'],
 [/health data|steps|watch.*sync|sync.*watch|health connect/,'telemetry','exerciseTracker'],
 [/food log|nutrition|meal|fuel/,'nutrition','nutritionDashboard'],
 [/train together|host a workout|join a workout/,'together','trainTogetherPanel'],
 [/friends|squad|social|leaderboard/,'social','osSocialCommand'],
 [/alerts|what.?s new/,'alerts','systemAlertCenter'],
 [/tutorial|how to use/,'tutorial',''],
 [/back ?up|import|sound settings|change my units|profile|settings/,'profile','profileSettings'],
 [/streak/,'progress','progressAnalytics'],
 [/compare.*workout|recent workouts|show my progress|progress history/,'progress','progressAnalytics']
];
const numbers={one:1,two:2,three:3,four:4,five:5,six:6,eight:8,ten:10,twelve:12,fifteen:15,sixteen:16,twenty:20,thirty:30,forty:40,fortyfive:45,sixty:60};
function numberValue(x){return numbers[x]??Number(x)}
function interpret(input,context={}){
 const s=String(input).toLowerCase().replace(/[’']/g,"'").replace(/[?!]/g,'').replace(/\.(?!\d)/g,'').trim();
 if(/^(?:please )?(cancel|stop|never mind|nevermind)$/.test(s))return {type:'cancel'};
 if(/\b(delete|reset|erase)\b/.test(s))return {type:'unsupported'};
 if(/^(yes|confirm|do it|go ahead|okay|ok)$/.test(s))return {type:'confirm'};
 if(/stop (?:speaking|talking|voice)|be quiet/.test(s))return {type:'silence'};
 if(/repeat|say that again/.test(s))return {type:'repeat'};
 if(/unmute/.test(s))return {type:'mute',value:false};
 if(/mute.*(?:voice|spoken|replies)/.test(s))return {type:'mute',value:true};
 if(/close (?:the )?(?:assistant|voice)/.test(s))return {type:'close'};
 if(/\b(log|add|record|drank)\b/.test(s)&&/\b(water|ounce|ounces|oz|milliliters|ml)\b/.test(s)){
  const m=s.match(/\b(\d+(?:\.\d+)?|eight|sixteen|twenty|thirty)\b/),amount=m?numberValue(m[1]):0,ml=/\b(ml|milliliters)\b/.test(s);
  if(/-\s*\d/.test(s)||!/\b(ounces?|oz|milliliters|ml)\b/.test(s)||!amount||amount<=0||amount>(ml?2000:64))return {type:'water-invalid'};
  return {type:'water',amount:Math.round((ml?amount/29.5735:amount)*10)/10};
 }
 if(/\b(water|hydration)\b/.test(s))return {type:'water-total'};
 if(/-\s*\d/.test(s)&&/reps?|pounds?|lbs?|kg|kilograms?/.test(s))return {type:'set-invalid'};
 if(/this.*hurts|\bpain\b|stop (?:this|the) exercise/.test(s))return {type:'pain'};
 const rir=s.match(/\b(\d+|one|two|three|four)\s+(?:good )?(?:reps?|repetitions?) (?:left|in reserve)/);if(rir)return {type:'effort',rir:numberValue(rir[1])};
 if(/too hard|couldn.t finish|felt easy|was easy/.test(s))return {type:'effort',rir:/easy/.test(s)?4:0};
 const seconds=s.match(/\b(\d+)\s+seconds?\b/);if(seconds&&/did|log|record|completed/.test(s))return {type:'set',reps:Number(seconds[1]),weight:null,unit:'seconds',metric:false};
 const rep=s.match(/\b(\d+|one|two|three|four|five|six|eight|ten|twelve|fifteen|twenty)\s+(?:bodyweight )?reps?\b/),weight=s.match(/\b(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|kilograms?|kg)\b/);
 if(rep&&/did|log|record|completed/.test(s))return {type:'set',reps:numberValue(rep[1]),weight:weight?Number(weight[1]):null,metric:/kilograms?|\bkg\b/.test(s)};
 if(/(?:start|resume|continue).*(?:workout|session)|continue where i left off/.test(s))return {type:'start-workout'};
 if(/finish.*workout|end workout/.test(s))return {type:'finish-workout'};
 if(/exit.*session|save my progress|leave.*workout/.test(s))return {type:'exit-workout'};
 if(/skip.*rest/.test(s))return {type:'skip-rest'};
 if(/(?:pause|stop|resume|start|reset).*(?:timer|countdown)/.test(s))return {type:'timer',action:/pause|stop/.test(s)?'pause':/reset/.test(s)?'reset':'start'};
 if(/sets.*left|sets.*remaining/.test(s))return {type:'remaining'};
 if(/proper form|how do i do|movement guide|show.*form/.test(s))return {type:'guide'};
 if(/replace.*exercise|another.*exercise|don.t have.*equipment/.test(s))return {type:'alternatives'};
 if(context.choices?.length&&/^(?:use |choose |the )*(?:first|second|third|[123])(?: one)?$/.test(s)){const n=/second|2/.test(s)?1:/third|3/.test(s)?2:0;return {type:'choice',index:n};}
 if(/(?:switch|use|working out|train|i.m|i am).*(?:gym|bodyweight|body weight|at home)/.test(s)&&!/hybrid/.test(s))return {type:'equipment',value:/gym/.test(s)?'gym':'bodyweight'};
 if(/weight.*(?:use|recommend)|what did i lift|last.*weight/.test(s))return {type:'weight'};
 const mins=s.match(/\b(\d+|five|ten|fifteen|twenty|thirty|fortyfive|sixty)\s*[- ]?(?:minutes?|mins?)\b/);
 const activity=/walk|walking/.test(s)?'Brisk Walk':/stretch/.test(s)?'Stretching':/bike ride|cycling/.test(s)?'Bike Ride':null;
 if(activity&& !/what|history/.test(s))return {type:'activity',name:activity,minutes:mins?numberValue(mins[1]):null};
 if(context.activity&&mins)return {type:'activity',name:context.activity,minutes:numberValue(mins[1])};
 if(/only have|shorter workout|full session|easier session/.test(s))return {type:'duration',minutes:mins?numberValue(mins[1]):null,full:/full session/.test(s)};
 if(/i.m tired|i am tired|muscles are sore|fatigued/.test(s))return {type:'readiness'};
 for(const [re,module,target] of ROUTES)if(re.test(s)){const result={type:'route',module,target};if(module==='exercise'&&/find|show.*exercises/.test(s)){const word=s.match(/dumbbell|barbell|chest|leg|core|band|bodyweight/);if(word)result.query=word[0];}return result;}
 if(/\b(open|show|go to)\b/.test(s))for(const [word,module] of [['player','player'],['progress','progress'],['health','telemetry'],['fuel','nutrition'],['settings','profile'],['training','missions'],['mission','missions'],['social','social']])if(s.includes(word))return {type:'open',module};
 if(/\b(sleep|slept)\b/.test(s))return {type:'sleep'};
 if(/\b(health briefing|health summary|recovery briefing)\b/.test(s))return {type:'health-briefing'};
 if(/\b(mission|workout|training|next|briefing)\b/.test(s))return {type:'mission'};
 if(/\b(progress|level|leveling|rank|xp|experience|improving)\b/.test(s))return {type:'progress'};
 if(/\b(help|commands|can you do|features|find something)\b/.test(s))return {type:'help'};
 return {type:'unknown'};
}
if(typeof module!=='undefined'&&module.exports){module.exports={interpret,COMMAND_GUIDE};return}
let dialog,reply,status,listen,mute,field,pending=null,timer=null,context={},lastReply='',expires=0;
const native=()=>root.SystemVoiceNative;
const text=id=>document.getElementById(id)?.textContent.trim()||'';
const setStatus=s=>{status.textContent=s;document.body.classList.remove('system-voice-listening','system-voice-speaking')};
function stop(){clearTimeout(timer);native()?.stop();document.body.classList.remove('system-voice-listening','system-voice-speaking')}
function answer(s){lastReply=s;reply.textContent=s;setStatus('Ready');if(!mute.checked)native()?.speak(s)}
function waterTotal(){const s=ensureNutrition();return fuelDay(s).water.reduce((a,n)=>a+Number(n||0),0)}
function isLive(){return document.getElementById('workoutMode')?.classList.contains('active')}
function currentSet(){if(!isLive())return null;const m=missionForMode(adaptiveSystemMission());return flatSets(m)[liveIndex]||null}
function locationToken(){const x=currentSet();return x?systemMissionKey()+':'+getWorkoutMode()+':'+liveIndex+':'+x.name:null}
function offer(command,message){pending={...command,token:locationToken()};expires=Date.now()+60000;document.getElementById('assistantSave').textContent=command.type==='water'?'CONFIRM WATER LOG':'CONFIRM';document.getElementById('assistantConfirm').hidden=false;answer(message+' Say confirm or tap Confirm.');}
function dismiss(){stop();pending=null;context={};document.getElementById('assistantConfirm').hidden=true;dialog.close();}
function navigate(module,target){dismiss();if(module==='tutorial'){root.SystemTutorial?.show();return}if(module==='alerts'){document.getElementById('systemAlertBtn')?.click();return}if(module==='together'){document.getElementById('quickTogether')?.click();return}root.SystemOS?.open(module);const el=target?.startsWith('.')?document.querySelector(target):document.getElementById(target);if(el){for(let n=el;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;el.scrollIntoView({block:'start'});el.querySelector('input,select,button')?.focus({preventScroll:true});}}
function confirmPending(){if(!pending){answer('There is no change waiting for confirmation. Tell me what you want to do.');return}const p=pending;pending=null;document.getElementById('assistantConfirm').hidden=true;if(Date.now()>expires){answer('That request expired. Please ask again.');return}if(p.token&&p.token!==locationToken()){answer('The current set changed. Please repeat your request for this set.');return}
 try{switch(p.type){
 case 'water':{const n=ensureNutrition();fuelDay(n).water.push(p.amount);saveNutrition(n);renderNutrition();answer('Logged '+p.amount+' fluid ounces. Today’s total is '+waterTotal()+' fluid ounces.');break;}
 case 'start-workout':dismiss();startWorkoutMode();break;
 case 'equipment':if(sessionEquipmentLocked()){answer('This session is already locked. Change equipment before starting your next session.');return}setSessionEquipment(p.value);answer('This session now uses '+(p.value==='gym'?'gym equipment':'bodyweight')+'. Your saved training preference is unchanged.');break;
 case 'duration':{if(sessionEquipmentLocked()){answer('The session has started. Keep its plan or exit and review your next session.');return}const k='systemMissionTraining:'+systemMissionKey()+':readiness';let r={};try{r=JSON.parse(localStorage.getItem(k)||'{}')}catch(_){}r.minutes=p.minutes;localStorage.setItem(k,JSON.stringify(r));renderSystemMission();answer('Time available set to '+p.minutes+' minutes. Review Training before starting.');break;}
 case 'exit-workout':dismiss();closeWorkout();break;
 case 'set':document.getElementById('liveReps').value=p.reps;if(p.weight!=null)document.getElementById('liveWeight').value=p.weight;dismiss();completeLiveSet();break;
 case 'effort':{const el=document.getElementById('trainingRir');if(!el){answer('Effort feedback is available in personalized training sessions. Open your training plan to configure it.');return}el.value=String(Math.min(4,p.rir));answer('Set feedback prepared: '+p.rir+' good repetitions left. It saves when you complete this set.');break;}
 case 'activity':{navigate('missions','workoutBuilder');const form=document.getElementById('builderForm');delete form.dataset.edit;document.getElementById('builderName').value=p.name+' • '+p.minutes+' min';document.getElementById('builderMinutes').value=p.minutes;document.getElementById('builderStat').value=p.name==='Stretching'?'Recovery':'Endurance';document.getElementById('builderExercises').innerHTML='';addBuilderExercise({name:p.name,sets:1,target:p.minutes+' min',rest:0});break;}
 case 'choice':{if(sessionEquipmentLocked()){answer('Exercise selection is locked during this session.');return}const selects=[...document.querySelectorAll('#mission-exercises select')],el=selects[p.selectIndex];if(!el||![...el.options].some(o=>o.value===p.name)){answer('Those alternatives changed. Ask for alternatives again.');return}el.value=p.name;el.dispatchEvent(new Event('change'));answer('Selected '+p.name+' for this session.');break;}
 }}catch(_){answer('That change could not be completed. Open the feature and check its current state before trying again.');}}
function showHelp(){answer('Choose a request below, or say it in your own words. Navigation opens immediately. Changes require confirmation.');const box=document.getElementById('assistantCommands');box.hidden=false;box.innerHTML='';COMMAND_GUIDE.forEach(([title,...commands])=>{const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title;section.append(summary);commands.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c;b.onclick=()=>run(c);section.append(b)});box.append(section)});}
function run(input){
 stop();if(Date.now()>(context.expires||0))context={};const command=interpret(input,context);if(command.type==='confirm'){confirmPending();return}pending=null;document.getElementById('assistantConfirm').hidden=true;document.getElementById('assistantCommands').hidden=true;
 document.getElementById('assistantHeard').textContent='You: '+input;
 switch(command.type){
 case 'cancel':context={};answer('Canceled. No changes made.');break;
 case 'water':offer(command,'Log '+command.amount+' fluid ounces of water?');break;
 case 'water-invalid':answer('Please give an amount, such as “log 16 ounces of water” or “log 250 ml of water.” You can log up to 64 ounces at a time.');break;
 case 'water-total':answer('You have logged '+waterTotal()+' fluid ounces of water today.');break;
 case 'sleep':answer(root.SystemSleepTracker?.briefing(healthTelemetry())||'Sleep tracking is unavailable. Open Health and sync again.');break;
 case 'health-briefing':answer(root.SystemHealthInsights?.summarize(healthTelemetry()).text||'Health context is unavailable. Open Health to check your connection.');break;
 case 'mission':answer('Today’s mission is '+(text('dockMissionTitle')||text('mission-title')||'available in Training')+'. '+(text('dockMissionStatus')||'')+'. Open Training to review and begin your session.');break;
 case 'progress':answer('Your current level is '+text('hudPlayerLevel')+', '+text('hudPlayerRank')+'. Experience: '+text('hudXpText')+'. Missions cleared: '+text('hudWorkouts')+'. Current streak: '+text('hudStreak')+' days.');break;
 case 'open':navigate(command.module);break;
 case 'route':navigate(command.module,command.target);if(command.query){const search=document.getElementById('librarySearch');if(search){search.value=command.query;document.getElementById('libraryMuscle').value='all';document.getElementById('libraryEquipment').value='all';renderExerciseLibrary();}}break;
 case 'help':showHelp();break;
 case 'silence':setStatus('Voice stopped');break;
 case 'repeat':answer(lastReply||'Ask me about training, health or another feature.');break;
 case 'mute':mute.checked=command.value;mute.onchange();answer(command.value?'Spoken replies muted.':'Spoken replies enabled.');break;
 case 'close':dismiss();break;
 case 'pain':stopTimedSet();if(typeof restTimer!=='undefined')clearInterval(restTimer);answer('Stop the affected movement. I paused the set countdown and rest timer. No set was logged. Exit the session or review your movement restrictions; I will not choose another exercise automatically.');break;
 case 'start-workout':offer(command,'Review and start or resume today’s workout?');break;
 case 'equipment':offer(command,'Use '+(command.value==='gym'?'gym equipment':'bodyweight')+' for this session?');break;
 case 'duration':if(command.full){navigate('missions','missionModeChoices');break}if(!systemPlayerProfile().profile?.trainingVersion){navigate('profile','trainingProfileForm');break}if(command.minutes==null){answer('How many minutes do you have? Say “I only have 20 minutes.”');break}if(command.minutes<15||command.minutes>90){answer('Personalized sessions support 15 to 90 minutes. For a shorter activity, say “walk for 10 minutes.”');break}offer(command,'Adjust today’s available time to '+command.minutes+' minutes?');break;
 case 'activity':if(command.minutes==null){context={activity:command.name,expires:Date.now()+60000};answer('For how many minutes? For example, say “15 minutes.”');break}if(command.minutes<5||command.minutes>180){answer('Choose an activity between 5 and 180 minutes.');break}offer(command,'Prepare a '+command.minutes+' minute '+command.name+' in Workout Builder? This replaces any unsaved builder draft. You will review and save it there.');context={};break;
 case 'set-invalid':answer('Please enter non-negative weight and a positive number of repetitions.');break;
 case 'set':if(!isLive()){navigate('telemetry','exerciseForm');break}if(timedSetDuration>0&&command.unit!=='seconds'||!timedSetDuration&&command.unit==='seconds'){answer('This exercise uses '+(timedSetDuration?'seconds':'repetitions')+'. Please log the matching unit.');break}if(!document.getElementById('restPanel').hidden){answer('You are resting between sets. Say “skip the rest timer” when you are ready for the next set.');break}if(command.metric){answer('This workout logs pounds. Enter the equivalent pounds in the weight field before saving.');break}if(command.reps<1||command.reps>500||command.weight!=null&&(command.weight<0||command.weight>2000)){answer('Please review the repetitions and weight in the workout controls.');break}offer(command,'Complete the current set with '+command.reps+(command.unit==='seconds'?' seconds':' repetitions')+(command.weight!=null?' at '+command.weight+' pounds':' and the weight currently shown')+'?');break;
 case 'effort':if(!isLive()){answer('Start a personalized workout before entering feedback for a set.');break}offer(command,'Prepare effort feedback for this set: '+command.rir+' good repetitions left?');break;
 case 'finish-workout':answer(isLive()?'Workouts finish when their prescribed sets are completed. Say “save my progress for later” to exit without claiming completion.':'No workout is active. Say “start my workout” to review today’s session.');break;
 case 'exit-workout':if(!isLive()){answer('No workout is currently active.');break}offer(command,'Exit and keep completed sets saved for later? This will not mark the workout complete.');break;
 case 'remaining':{if(!isLive()){answer('No workout is currently active.');break}const m=missionForMode(adaptiveSystemMission()),p=getMissionProgress(),sets=flatSets(m);answer(sets.filter(x=>!p[x.ei+'-'+x.si]?.done).length+' sets remain.');break;}
 case 'timer':if(!isLive()||!timedSetDuration){answer('The set countdown is available during a timed exercise. Your overall workout clock is separate.');break}if(command.action==='reset')resetTimedSet();else if(command.action==='pause'&&timedSetEndAt||command.action==='start'&&!timedSetEndAt)toggleTimedSet();answer('Set countdown '+(command.action==='reset'?'reset':command.action==='pause'?'paused':'started')+'.');break;
 case 'skip-rest':if(isLive()&&!document.getElementById('restPanel').hidden){endRest();answer('Rest skipped. Review your next set.');}else answer('No rest timer is running.');break;
 case 'guide':if(!isLive()){navigate('exercise','exerciseLibrary');break}dismiss();root.SystemExerciseGuide?.open();break;
 case 'weight':{const x=currentSet();if(!x){answer('Start a workout to ask about its current exercise. You can also open personal records.');break}const rec=root.SystemTraining?.recommendation(x.name,x.target,workoutHistory(),root.SystemTraining.profile(systemPlayerProfile()).increment,systemMissionKey());answer(x.name+': '+(rec?.weight>0?'Suggested working weight '+rec.weight+' pounds. ':'')+(rec?.reason||'Review your last workout records before choosing a working load.'));break;}
 case 'alternatives':{if(sessionEquipmentLocked()){answer('Exercise selection is locked once a session starts. You can stop and review your movement restrictions in Settings.');break}navigate('missions','mission-exercises');root.SystemAssistant.open();const selects=[...document.querySelectorAll('#mission-exercises select')];if(!selects.length){answer('No equivalent alternatives are available for the current equipment. Review the exercise library or training equipment.');break}const el=selects[0],names=[...el.options].map(x=>x.value).filter(x=>x!==el.value).slice(0,3);context={choices:names,selectIndex:0,expires:Date.now()+60000};answer('Alternatives for '+el.value+': '+names.map((n,i)=>(i+1)+', '+n).join('; ')+'. Say “use the first one,” or review the other exercise dropdowns in Training.');break;}
 case 'choice':if(!context.choices[command.index]){answer('That option is not available. Ask for alternatives again.');break}offer({...command,name:context.choices[command.index],selectIndex:context.selectIndex},'Use '+context.choices[command.index]+'?');break;
 case 'readiness':navigate('missions','trainingReadiness');break;
 case 'unsupported':answer('That action isn’t supported by voice. Use the app’s controls to review and make that change.');break;
 default:context={};answer('I can help with Training, custom workouts, the exercise library, progress, health, fuel, social features or settings. Which one do you want? Tap Help for the full request list.');
 }
}
function start(){stop();if(!native()?.available()){setStatus('On-device speech is unavailable. Type a command below.');return}setStatus('Preparing microphone…');document.body.classList.add('system-voice-listening');native().listen();timer=setTimeout(()=>{stop();setStatus('Listening stopped. Tap Listen to try again.')},20000)}
function open(auto=false){if(!dialog.open)dialog.showModal();setStatus('Local assistant • Ready');if(auto)start();else field.focus()}
function init(){
 dialog=document.createElement('dialog');dialog.id='systemAssistant';dialog.className='system-assistant';dialog.innerHTML='<header><span>SYSTEM // VOICE LINK</span><button type="button" id="assistantClose" aria-label="Close assistant">×</button></header><p id="assistantStatus" role="status"></p><p id="assistantHeard"></p><p id="assistantReply" aria-live="polite">Ready when you are. Ask about your mission, progress, or water log.</p><div class="assistant-controls"><button type="button" id="assistantListen">LISTEN</button><button type="button" id="assistantStop">STOP VOICE</button><label><input type="checkbox" id="assistantMute"> Mute spoken replies</label></div><form id="assistantForm"><label for="assistantInput">Or type a command</label><div><input id="assistantInput" maxlength="240" autocomplete="off" placeholder="What’s my mission today?"><button type="submit">SEND</button></div></form><div id="assistantConfirm" hidden><button type="button" id="assistantSave">CONFIRM WATER LOG</button><button type="button" id="assistantCancel">CANCEL</button></div><small>On-device voice • No AI subscription • Tap Help for supported commands</small><button type="button" id="assistantHelp">HELP / ALL REQUESTS</button><div id="assistantCommands" hidden></div>';
 document.body.append(dialog);reply=document.getElementById('assistantReply');status=document.getElementById('assistantStatus');listen=document.getElementById('assistantListen');mute=document.getElementById('assistantMute');field=document.getElementById('assistantInput');
 mute.checked=localStorage.getItem('system-voice-muted')==='true';mute.onchange=()=>{localStorage.setItem('system-voice-muted',String(mute.checked));if(mute.checked)stop()};
 listen.onclick=start;document.getElementById('assistantStop').onclick=()=>{stop();setStatus('Voice stopped')};document.getElementById('assistantClose').onclick=()=>dismiss();
 dialog.addEventListener('close',()=>{if(dialog.open)return;stop();pending=null;context={};document.getElementById('assistantConfirm').hidden=true});
 document.getElementById('assistantForm').onsubmit=e=>{e.preventDefault();const value=field.value.trim();if(value){field.value='';run(value)}};
 document.getElementById('assistantHelp').onclick=()=>run('help');document.getElementById('assistantCancel').onclick=()=>run('cancel');
 document.getElementById('assistantSave').onclick=confirmPending;
 const core=document.getElementById('coreIdle');core.tabIndex=0;core.setAttribute('role','button');core.setAttribute('aria-label','Talk to The System');core.title='Tap to talk to The System';const hint=document.createElement('span');hint.className='core-voice-hint';hint.textContent='TAP TO TALK';core.append(hint);core.addEventListener('click',e=>{e.stopPropagation();open(true)});core.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(true)}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();setStatus('Voice stopped while app is in the background')}});
}
root.SystemAssistant={open,interpret,commands:COMMAND_GUIDE,nativeEvent(event){if(!dialog?.open)return;clearTimeout(timer);if(event.type==='result'){run(event.text);return}setStatus(event.text);if(event.type==='listening'||event.type==='processing'){document.body.classList.add('system-voice-listening');timer=setTimeout(()=>{stop();setStatus('Listening stopped. Please try again.')},20000)}if(event.type==='speaking')document.body.classList.add('system-voice-speaking')}};
document.addEventListener('DOMContentLoaded',init);
})(typeof window!=='undefined'?window:globalThis);

