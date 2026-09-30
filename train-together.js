/* Shared readiness only; metrics and rewards always use the existing player pipeline. */
(() => {
 let session=null, owner=null, timer=null, busy=false, localXp=0, finished=false, launching=false;
 const solo={mission:missionForMode,key:missionProgressKey,complete:completeLiveSet,close:closeWorkout};
 const active=()=>session && getCloudSession()?.user?.id===owner;
 const rpc=async body=>{const row=await cloudRequest('/rest/v1/rpc/training_session',{method:'POST',body:JSON.stringify(body)});return Array.isArray(row)?row[0]:row;};
 const panel=()=>document.getElementById('trainTogetherPanel');
 const status=message=>{document.getElementById('ttStatus').textContent=message;};
 const done=()=>session[owner===session.host_id?'host_done':'guest_done']>=session.cursor;
 missionForMode=function(m,mode){return active()?{...session.mission,xp:localXp}:solo.mission(m,mode);};
 missionProgressKey=function(){return active()?'systemTrainTogetherProgress:'+owner+':'+session.id:solo.key();};
 function hideBrief(){const b=document.getElementById('missionLaunchConfirm');b?.classList.remove('active');b?.setAttribute('aria-hidden','true');document.body.classList.remove('mission-brief-open');}
 function paint(){
  if(!active())return;
  const waiting=session.status==='waiting';
  status(waiting?'Share code '+session.code+' with your partner.':session.status==='completed'?'Session complete.':session.status==='cancelled'?'Partner left. Exit and begin a solo mission.':done()?'Set saved. Waiting for your partner…':'Connected • Set '+(session.cursor+1)+' of '+session.total_sets);
  document.getElementById('completeLiveSet').disabled=busy||waiting||done()||session.status!=='active';
  if(!waiting && !launching && session.status==='active'){
   launching=true;hideBrief();document.getElementById('ttLive').appendChild(document.getElementById('ttStatus'));panel().hidden=true;startWorkoutMode();
  }
  if(session.status==='active' && launching && liveIndex!==session.cursor){stopTimedSet();clearInterval(restTimer);document.getElementById('restPanel').hidden=true;liveIndex=session.cursor;renderLiveSet();}
  if(session.status==='completed'&&!finished){finished=true;finishWorkout();}
 }
 async function poll(){
  if(busy||!session)return;
  if(!active()){detach();return;}
  const id=session.id;
  try{const rows=await cloudRequest('/rest/v1/training_sessions?id=eq.'+encodeURIComponent(id)+'&select=*');if(session?.id!==id)return;if(!rows.length)throw Error('Session unavailable');session=rows[0];if(Date.parse(session.expires_at)<=Date.now())session.status='cancelled';paint();}
  catch(e){status('Connection interrupted. Retrying… '+e.message);document.getElementById('completeLiveSet').disabled=true;}
 }
 function attach(row){localXp=solo.mission(adaptiveSystemMission(),row.mission.mode).xp;session=row;owner=getCloudSession().user.id;finished=false;launching=false;busy=false;document.getElementById('ttLive').hidden=false;clearInterval(timer);timer=setInterval(poll,1500);paint();}
 function detach(){clearInterval(timer);timer=null;session=null;owner=null;launching=false;document.getElementById('completeLiveSet').disabled=false;document.getElementById('ttLive').hidden=true;panel().appendChild(document.getElementById('ttStatus'));}
 async function connect(action){
  if(busy||session)return;
  try{
   if(!getCloudSession()?.user?.id)throw Error('Sign in first to train together.');
   const completed=JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey())||'null');if(completed?.mode==='full')throw Error('Today’s full mission is already complete.');
   const m=solo.mission(adaptiveSystemMission());localXp=m.xp;busy=true;status('Connecting…');
   const row=await rpc(action==='host'?{action,workout:m}:{action,join_code:document.getElementById('ttCode').value.trim()});attach(row);
  }catch(e){status(e.message);}finally{busy=false;}
 }
 completeLiveSet=async function(){
  if(!session)return solo.complete();
  if(!active()||busy||session.status!=='active'||done())return;
  busy=true;document.getElementById('completeLiveSet').disabled=true;stopTimedSet();
  const current=session,id=current.id,index=current.cursor,sets=flatSets(missionForMode(adaptiveSystemMission())),x=sets[index],p=getMissionProgress();
  p[x.ei+'-'+x.si]={done:true,reps:Math.max(0,Number(document.getElementById('liveReps').value)||0),weight:Math.max(0,Number(document.getElementById('liveWeight').value)||0)};saveMissionProgress(p);
  try{const row=await rpc({action:'complete',session_id:id,set_index:index});if(session?.id===id)session=row;}
  catch(e){status('Your entries are saved. Retry Complete Set. '+e.message);}
  finally{busy=false;if(session?.id===id){if(session===current)document.getElementById('completeLiveSet').disabled=false;else paint();}}
 };
 closeWorkout=function(){const old=session;if(old&&active()&&old.status!=='completed')rpc({action:'leave',session_id:old.id}).catch(()=>{});solo.close();detach();};
 document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('mlcLaunch');if(!b)return;
  b.insertAdjacentHTML('afterend','<button id="ttOpen" type="button" class="tt-secondary">TRAIN TOGETHER</button><section id="trainTogetherPanel" hidden><p>Share this workout. Record your own reps and weights. Each player earns their own XP.</p><button id="ttHost" type="button">HOST SESSION</button><label>Session code <input id="ttCode" maxlength="10" autocomplete="off" placeholder="Partner’s code"></label><button id="ttJoin" type="button">JOIN SESSION</button><button id="ttCancel" type="button">BACK TO SOLO</button><p id="ttStatus" role="status" aria-live="polite"></p></section>');
  document.getElementById('workoutMode').insertAdjacentHTML('afterbegin','<div id="ttLive" hidden></div>');
  document.getElementById('ttOpen').onclick=()=>{panel().hidden=false;};
  document.getElementById('ttHost').onclick=()=>connect('host');document.getElementById('ttJoin').onclick=()=>connect('join');
  document.getElementById('ttCancel').onclick=()=>{closeWorkout();panel().hidden=true;};
  document.getElementById('mlcClose').addEventListener('click',()=>{if(session)closeWorkout();panel().hidden=true;});
  b.addEventListener('click',()=>{if(session)closeWorkout();panel().hidden=true;});
  document.getElementById('completeLiveSet').onclick=completeLiveSet;document.getElementById('exitWorkoutBtn').onclick=closeWorkout;
 });
})();
