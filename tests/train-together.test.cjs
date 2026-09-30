const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
for(const f of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;',''));
const ids=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
for(const id of ids)await db.query('insert into auth.users values($1,$2)',[id,id+'@test.invalid']);
async function as(id,fn){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`);return fn();}
async function rpc(id,body){return as(id,async()=>(await db.query('select * from public.training_session($1,$2,$3,$4,$5)',[body.action,body.session_id||null,body.join_code||null,body.workout?JSON.stringify(body.workout):null,body.set_index??null])).rows[0]);}
function player(id,xp){
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://system.test',runScripts:'outside-only'}),w=dom.window,c=dom.getInternalVMContext(),ticks=[];
// Exercise the actual production solo start/set/finish functions, with surrounding app services isolated.
const m={name:'Test workout',focus:'Strength',exercises:[['Squat',2,'5',0]],xp,mode:'full',credit:1};
Object.assign(w,{missionForMode:m=>m,adaptiveSystemMission:()=>m,systemMissionKey:()=> '2026-09-29',missionProgressKey:()=> 'systemMissionProgress:solo',getWorkoutMode:()=> 'full',workoutModeKey:()=> 'mode',getMissionProgress:()=>JSON.parse(w.localStorage.getItem(w.missionProgressKey())||'{}'),saveMissionProgress:p=>w.localStorage.setItem(w.missionProgressKey(),JSON.stringify(p)),flatSets:m=>m.exercises.flatMap((e,ei)=>Array.from({length:e[1]},(_,si)=>({ei,si,name:e[0],target:e[2],rest:e[3]}))),parseTargetReps:()=>5,getMissionRecords:()=>JSON.parse(w.localStorage.getItem('records')||'{}'),missionRecordsKey:()=> 'records',workoutHistory:()=>JSON.parse(w.localStorage.getItem('systemWorkoutSessions')||'[]'),fmt:String,stopTimedSet(){},renderTimedSetControls(){},addXp:n=>w.earned+=n,earned:0,updateWorkoutStreak(){},recordHistory(){},addSystemMessage(){},saveState(){},renderAll(){},renderSystemMission(){},renderAnalytics(){},showMissionDebrief(){},getCloudSession:()=>({user:{id}}),setInterval:(fn,ms)=>{if(ms===1500)ticks.push(fn);return ticks.length},clearInterval(){},setTimeout:fn=>fn(),cloudRequest:async(path,opts)=>opts?rpc(id,JSON.parse(opts.body)):as(id,async()=>(await db.query('select * from public.training_sessions where id=$1',[path.match(/id=eq.([^&]+)/)[1]])).rows)});
vm.runInContext('let liveIndex=0,workoutStartedAt=0,liveTimer=null,restTimer=null;',c);
const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(app.indexOf('function startWorkoutMode(){'),app.indexOf("document.addEventListener('DOMContentLoaded',()=>{renderSystemMission();")),c);
w.document.body.insertAdjacentHTML('beforeend','<section id="missionLaunchConfirm"><button id="mlcLaunch"></button><button id="mlcClose"></button></section>');
vm.runInContext(fs.readFileSync('train-together.js','utf8'),c);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
return{w,el:id=>w.document.getElementById(id),poll:()=>ticks.at(-1)(),close:()=>dom.window.close()};
}
const a=player(ids[0],100),b=player(ids[1],60);
// Solo preserves existing local keys, transitions and rewards without any session.
a.w.startWorkoutMode();for(let i=0;i<2;i++){a.el('liveReps').value=7;a.el('liveWeight').value=25;await a.w.completeLiveSet();}
assert.equal(a.w.earned,100);assert.equal(a.w.workoutHistory().length,1);assert.equal(a.w.getMissionProgress()['0-0'].weight,25);
a.w.localStorage.clear();a.w.earned=0;
await a.el('ttHost').onclick();const sessions=await as(ids[0],async()=>(await db.query('select * from public.training_sessions')).rows),s=sessions[0];assert.equal(s.status,'waiting');assert.match(a.el('ttStatus').textContent,new RegExp(s.code));
b.el('ttCode').value=s.code;await b.el('ttJoin').onclick();await a.poll();
assert.equal(a.el('liveExerciseName').textContent,'Squat');assert.equal(b.el('liveExerciseName').textContent,'Squat');
await assert.rejects(rpc(ids[2],{action:'join',join_code:s.code}),/full/);
await assert.rejects(rpc(ids[2],{action:'complete',session_id:s.id,set_index:0}),/participant/);
assert.equal((await as(ids[2],()=>db.query('select * from public.training_sessions'))).rows.length,0);
await assert.rejects(as(ids[0],()=>db.query('update public.training_sessions set cursor=2')),/permission denied/);
a.el('liveReps').value=8;a.el('liveWeight').value=100;const request=a.w.cloudRequest;a.w.cloudRequest=async()=>{throw Error('offline')};await a.w.completeLiveSet();assert.match(a.el('ttStatus').textContent,/entries are saved/);assert.equal(a.w.getMissionProgress()['0-0'].weight,100);a.w.cloudRequest=request;await a.w.completeLiveSet();assert.match(a.el('ttStatus').textContent,/Waiting/);assert.equal(a.el('liveExerciseCount').textContent,'SET 1 OF 2');
b.el('liveReps').value=5;b.el('liveWeight').value=50;await b.w.completeLiveSet();await a.poll();assert.equal(a.el('liveExerciseCount').textContent,'SET 2 OF 2');assert.equal(b.el('liveExerciseCount').textContent,'SET 2 OF 2');
await rpc(ids[0],{action:'complete',session_id:s.id,set_index:0}); // safe retry cannot skip
for(const p of [a,b]){p.el('liveReps').value=p===a?9:6;p.el('liveWeight').value=p===a?110:55;await p.w.completeLiveSet();}await a.poll();
assert.equal(a.w.earned,100);assert.equal(b.w.earned,60);assert.equal(a.w.workoutHistory()[0].sets[0].weight,100);assert.equal(b.w.workoutHistory()[0].sets[0].weight,50);assert.equal(a.w.getMissionProgress()['0-0'],undefined);assert.equal(b.w.getMissionProgress()['0-0'],undefined);
assert.equal((await rpc(ids[0],{action:'complete',session_id:s.id,set_index:1})).cursor,2);
await a.poll();assert.equal(a.w.earned,100);
// New lobby: expiry, cancellation and no unauthorized anonymous execution.
const lobby=await rpc(ids[0],{action:'host',workout:{exercises:[['Walk',1,'30s',0]]}});
await rpc(ids[0],{action:'leave',session_id:lobby.id});await assert.rejects(rpc(ids[1],{action:'join',join_code:lobby.code}),/closed/);
const expired=await rpc(ids[0],{action:'host',workout:{exercises:[['Walk',1,'30s',0]]}});await db.exec('reset role');await db.query("update public.training_sessions set expires_at=now()-interval '1 second' where id=$1",[expired.id]);await assert.rejects(rpc(ids[1],{action:'join',join_code:expired.code}),/expired/);await assert.rejects(rpc(ids[0],{action:'host',workout:{exercises:[['Bad',-1,'5',0]]}}),/Invalid exercise/);
await db.exec('reset role;set role anon');await assert.rejects(db.query("select public.training_session('host')"),/permission denied/);
a.close();b.close();await db.close();console.log('PASS: production solo flow, host/join, two-player barrier, private reps/weights/XP, retries, capacity, cancellation and database authorization');
})().catch(e=>{console.error(e);process.exit(1)});
