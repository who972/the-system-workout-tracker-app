const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
test('database enforces recipient consent, immutable rules and server-owned daily credits',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth to anon,authenticated;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
 const [A,B,C]=[1,2,3].map(n=>'00000000-0000-0000-0000-00000000000'+n);
 for(const id of [A,B,C])await db.query('insert into auth.users values($1,$2)',[id,id+'@test.invalid']);
 async function as(id){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id||''}',false);set role ${id?'authenticated':'anon'}`)}
 async function q(sql,args=[]){return (await db.query(sql,args)).rows;}
 const credit=async(action,id=null,mode='full')=>(await q('select public.workout_credit($1,$2,$3) as credit',[action,mode,id]))[0].credit;
 for(const [id,name] of [[A,'Player A'],[B,'Player B'],[C,'Player C']]){await as(id);await q('insert into public.social_profiles(user_id,display_name) values($1,$2)',[id,name])}
 await as(A);await assert.rejects(q('update public.social_profiles set xp=99999999 where user_id=$1',[A]),/server-managed/);await assert.rejects(q('update public.social_profiles set competitive_points=99999999 where user_id=$1',[A]),/server-managed/);
 const f=(await q('insert into public.social_friendships(requester_id,addressee_id,requester_name,addressee_name) values($1,$2,$3,$4) returning id',[A,B,'A','B']))[0].id;
 await assert.rejects(q("update public.social_friendships set status='accepted' where id=$1",[f]),/recipient/);await assert.rejects(q('update public.social_friendships set addressee_id=$1 where id=$2',[C,f]),/immutable/);
 await assert.rejects(q("insert into public.social_friendships(requester_id,addressee_id,requester_name,addressee_name,status) values($1,$2,'A','C','accepted')",[A,C]),/pending/);
 await as(B);await q("update public.social_friendships set status='accepted',accepted_at='1999-01-01' where id=$1",[f]);assert.equal((await q('select accepted_at from public.social_friendships where id=$1',[f]))[0].accepted_at.getUTCFullYear(),new Date().getUTCFullYear());
 await as(C);assert.equal((await q('select * from public.social_friendships')).length,0);
 await as(A);const c=await credit('start');assert.equal(c.completed,false);assert.equal((await credit('start',null,'light')).id,c.id);await assert.rejects(credit('complete',c.id),/at least one minute/);await assert.rejects(q('select * from private.workout_credits'),/permission denied/);
 await as(B);await assert.rejects(credit('complete',c.id),/not found/);
 await db.exec('reset role');await q("update private.workout_credits set started_at=now()-interval '2 minutes' where id=$1",[c.id]);
 await as(A);assert.equal((await credit('complete',c.id)).points,100);assert.equal((await credit('complete',c.id)).points,100);assert.equal((await credit('start',null,'full')).id,c.id);
 const p=(await q('select xp,missions from public.competitive_profiles where user_id=$1',[A]))[0];assert.equal(p.xp,100);assert.equal(p.missions,1);
 const duel=(await q("insert into public.social_challenges(challenger_id,opponent_id,challenger_name,opponent_name,type,duration_days,challenger_start) values($1,$2,'A','B','xp',1,99999999) returning *",[A,B]))[0];assert.equal(duel.challenger_start,0);
 await assert.rejects(q("update public.social_challenges set status='active' where id=$1",[duel.id]),/recipient/);
 await as(B);await q("update public.social_challenges set status='active',opponent_start=99999999 where id=$1",[duel.id]);await assert.rejects(q("update public.social_challenges set status='completed',opponent_final=99999999 where id=$1",[duel.id]),/has not ended/);await assert.rejects(q('update public.social_challenges set challenger_id=$1 where id=$2',[C,duel.id]),/immutable/);
 await q('update public.social_challenges set opponent_final=99999999 where id=$1',[duel.id]);assert.equal((await q('select opponent_final from public.social_challenges where id=$1',[duel.id]))[0].opponent_final,null);
 // Late finalization cannot count workouts after the challenge window or trust supplied scores.
 await db.exec('reset role;alter table public.social_challenges disable trigger enforce_duel_results');
 await q("update public.social_challenges set accepted_at=now()-interval '2 days',challenger_start=0,opponent_start=0 where id=$1",[duel.id]);
 await db.exec('alter table public.social_challenges enable trigger enforce_duel_results');
 await q("insert into private.workout_credits(user_id,credit_day,mode,started_at,completed_at,points) values($1,(now()-interval '36 hours')::date,'intense',now()-interval '37 hours',now()-interval '36 hours',70)",[B]);
 await as(B);await q("update public.social_challenges set status='completed',challenger_final=99999999,result='challenger' where id=$1",[duel.id]);
 const final=(await q('select challenger_final,opponent_final,result from public.social_challenges where id=$1',[duel.id]))[0];assert.deepEqual(final,{challenger_final:0,opponent_final:70,result:'opponent'});
 await as(A);const sa=(await q("insert into public.social_squads(name,owner_id) values('A Squad',$1) returning id",[A]))[0].id;
 await q("insert into public.social_squad_members(squad_id,user_id,display_name,role) values($1,$2,'A','owner')",[sa,A]);
 await as(B);const sb=(await q("insert into public.social_squads(name,owner_id) values('B Squad',$1) returning id",[B]))[0].id;
 await q("insert into public.social_squad_members(squad_id,user_id,display_name,role) values($1,$2,'B','owner')",[sb,B]);
 await as(A);const squad=(await q("insert into public.social_squad_challenges(challenger_squad_id,opponent_squad_id,challenger_name,opponent_name,type,duration_days,created_by) values($1,$2,'A Squad','B Squad','xp',1,$3) returning id",[sa,sb,A]))[0].id;
 await assert.rejects(q("update public.social_squad_challenges set status='active' where id=$1",[squad]),/receiving squad owner/);
 await as(B);await q("update public.social_squad_challenges set status='active',opponent_start=999999 where id=$1",[squad]);
 await assert.rejects(q("update public.social_squad_challenges set status='completed' where id=$1",[squad]),/has not ended/);
 await assert.rejects(q("update public.social_squad_challenges set duration_days=7 where id=$1",[squad]),/immutable/);
 await as(null);await assert.rejects(credit('start'),/permission denied/);await assert.rejects(q('select * from public.competitive_profiles'),/permission denied/);
 }finally{await db.close()}
});
