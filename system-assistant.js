/* Focused local assistant: no network calls, stored transcripts, or generated claims. */
(function(root){
'use strict';
function interpret(input){
 const s=String(input).toLowerCase().replace(/[?!]/g,'').replace(/\.(?!\d)/g,'').trim();
 if(/^(cancel|stop|never mind|nevermind)$/.test(s))return {type:'cancel'};
 if(/\b(delete|reset|erase|end workout|finish workout)\b/.test(s))return {type:'unsupported'};
 if(/\b(log|add|record|drank)\b/.test(s)&&/\b(water|ounce|ounces|oz|milliliters|ml)\b/.test(s)){
  const words={eight:8,sixteen:16,twenty:20,thirty:30};const m=s.match(/\b(\d+(?:\.\d+)?|eight|sixteen|twenty|thirty)\b/);
  const amount=m?(words[m[1]]||Number(m[1])):0;const ml=/\b(ml|milliliters)\b/.test(s);
  if(/-\s*\d/.test(s)||! /\b(ounces?|oz|milliliters|ml)\b/.test(s)||!amount||amount<=0||amount>(ml?2000:64))return {type:'water-invalid'};
  return {type:'water',amount:Math.round((ml?amount/29.5735:amount)*10)/10};
 }
 if(/\b(water|hydration)\b/.test(s))return {type:'water-total'};
 if(/\b(open|show|go to)\b/.test(s)){
  for(const [word,module] of [['player','player'],['progress','progress'],['health','telemetry'],['fuel','nutrition'],['settings','profile'],['training','missions'],['mission','missions'],['social','social']])if(s.includes(word))return {type:'open',module};
 }
 if(/\b(health briefing|health summary|recovery briefing)\b/.test(s))return {type:'health-briefing'};
 if(/\b(mission|workout|training|next|briefing)\b/.test(s))return {type:'mission'};
 if(/\b(progress|level|leveling|rank|xp|experience|improving)\b/.test(s))return {type:'progress'};
 if(/\b(help|commands|can you do)\b/.test(s))return {type:'help'};
 return {type:'unknown'};
}
if(typeof module!=='undefined'&&module.exports){module.exports={interpret};return}
let dialog,reply,status,listen,mute,field,pending=null,timer=null;
const native=()=>root.SystemVoiceNative;
const text=id=>document.getElementById(id)?.textContent.trim()||'';
const setStatus=s=>{status.textContent=s;document.body.classList.remove('system-voice-listening','system-voice-speaking')};
function stop(){clearTimeout(timer);native()?.stop();document.body.classList.remove('system-voice-listening','system-voice-speaking')}
function answer(s){reply.textContent=s;setStatus('Ready');if(!mute.checked)native()?.speak(s)}
function waterTotal(){const s=ensureNutrition();return fuelDay(s).water.reduce((a,n)=>a+Number(n||0),0)}
function run(input){
 stop();pending=null;document.getElementById('assistantConfirm').hidden=true;
 const command=interpret(input);document.getElementById('assistantHeard').textContent='You: '+input;
 switch(command.type){
 case 'cancel':answer('Canceled. No changes made.');break;
 case 'water':pending=command;document.getElementById('assistantConfirm').hidden=false;answer('Log '+command.amount+' fluid ounces of water? Tap Confirm to save it.');break;
 case 'water-invalid':answer('Please give an amount, such as “log 16 ounces of water” or “log 250 ml of water.” You can log up to 64 ounces at a time.');break;
 case 'water-total':answer('You have logged '+waterTotal()+' fluid ounces of water today.');break;
 case 'health-briefing':answer(root.SystemHealthInsights?.summarize(healthTelemetry()).text||'Health context is unavailable. Open Health to check your connection.');break;
 case 'mission':answer('Today’s mission is '+(text('dockMissionTitle')||text('mission-title')||'available in Training')+'. '+(text('dockMissionStatus')||'')+'. Open Training to review and begin your session.');break;
 case 'progress':answer('Your current level is '+text('hudPlayerLevel')+', '+text('hudPlayerRank')+'. Experience: '+text('hudXpText')+'. Missions cleared: '+text('hudWorkouts')+'. Current streak: '+text('hudStreak')+' days.');break;
 case 'open':dialog.close();root.SystemOS?.open(command.module);break;
 case 'help':answer('Ask for a health briefing, today’s mission, your level and progress, or your water total. Say “log 16 ounces of water” to prepare a log, or “open Player,” “open Health,” or “open Training” to navigate.');break;
 case 'unsupported':answer('That action isn’t supported by voice. Use the app’s controls to review and make that change.');break;
 default:answer('I didn’t recognize that command. Try “What’s my mission?”, “How close am I to leveling up?”, or “log 16 ounces of water.”');
 }
}
function start(){stop();if(!native()?.available()){setStatus('On-device speech is unavailable. Type a command below.');return}setStatus('Preparing microphone…');document.body.classList.add('system-voice-listening');native().listen();timer=setTimeout(()=>{stop();setStatus('Listening stopped. Tap Listen to try again.')},20000)}
function open(auto=false){if(!dialog.open)dialog.showModal();setStatus('Local assistant • Ready');if(auto)start();else field.focus()}
function init(){
 dialog=document.createElement('dialog');dialog.id='systemAssistant';dialog.className='system-assistant';dialog.innerHTML='<header><span>SYSTEM // VOICE LINK</span><button type="button" id="assistantClose" aria-label="Close assistant">×</button></header><p id="assistantStatus" role="status"></p><p id="assistantHeard"></p><p id="assistantReply" aria-live="polite">Ready when you are. Ask about your mission, progress, or water log.</p><div class="assistant-controls"><button type="button" id="assistantListen">LISTEN</button><button type="button" id="assistantStop">STOP VOICE</button><label><input type="checkbox" id="assistantMute"> Mute spoken replies</label></div><form id="assistantForm"><label for="assistantInput">Or type a command</label><div><input id="assistantInput" maxlength="240" autocomplete="off" placeholder="What’s my mission today?"><button type="submit">SEND</button></div></form><div id="assistantConfirm" hidden><button type="button" id="assistantSave">CONFIRM WATER LOG</button><button type="button" id="assistantCancel">CANCEL</button></div><small>On-device voice • No AI subscription • Tap Help for supported commands</small><button type="button" id="assistantHelp">HELP</button>';
 document.body.append(dialog);reply=document.getElementById('assistantReply');status=document.getElementById('assistantStatus');listen=document.getElementById('assistantListen');mute=document.getElementById('assistantMute');field=document.getElementById('assistantInput');
 mute.checked=localStorage.getItem('system-voice-muted')==='true';mute.onchange=()=>{localStorage.setItem('system-voice-muted',String(mute.checked));if(mute.checked)stop()};
 listen.onclick=start;document.getElementById('assistantStop').onclick=()=>{stop();setStatus('Voice stopped')};document.getElementById('assistantClose').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{stop();pending=null;document.getElementById('assistantConfirm').hidden=true});
 document.getElementById('assistantForm').onsubmit=e=>{e.preventDefault();const value=field.value.trim();if(value){field.value='';run(value)}};
 document.getElementById('assistantHelp').onclick=()=>run('help');document.getElementById('assistantCancel').onclick=()=>run('cancel');
 document.getElementById('assistantSave').onclick=()=>{if(!pending)return;const amount=pending.amount;pending=null;document.getElementById('assistantConfirm').hidden=true;try{const s=ensureNutrition();fuelDay(s).water.push(amount);saveNutrition(s);renderNutrition();answer('Logged '+amount+' fluid ounces. Today’s total is '+waterTotal()+' fluid ounces.')}catch(e){answer('The water log could not be saved. Please check Fuel before trying again.')}};
 const core=document.getElementById('coreIdle');core.tabIndex=0;core.setAttribute('role','button');core.setAttribute('aria-label','Talk to The System');core.title='Tap to talk to The System';const hint=document.createElement('span');hint.className='core-voice-hint';hint.textContent='TAP TO TALK';core.append(hint);core.addEventListener('click',e=>{e.stopPropagation();open(true)});core.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(true)}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();setStatus('Voice stopped while app is in the background')}});
}
root.SystemAssistant={open,interpret,nativeEvent(event){if(!dialog?.open)return;clearTimeout(timer);if(event.type==='result'){run(event.text);return}setStatus(event.text);if(event.type==='listening'||event.type==='processing'){document.body.classList.add('system-voice-listening');timer=setTimeout(()=>{stop();setStatus('Listening stopped. Please try again.')},20000)}if(event.type==='speaking')document.body.classList.add('system-voice-speaking')}};
document.addEventListener('DOMContentLoaded',init);
})(typeof window!=='undefined'?window:globalThis);

