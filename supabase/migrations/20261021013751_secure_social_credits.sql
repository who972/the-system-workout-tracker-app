-- Friendship consent and immutable participants.
create function private.guard_friendship() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.requester_id is distinct from auth.uid() or new.status<>'pending' then raise exception 'Friend requests must start pending'; end if;
  new.created_at:=now();new.accepted_at:=null;
 else
  if (new.requester_id,new.addressee_id,new.created_at) is distinct from (old.requester_id,old.addressee_id,old.created_at) then raise exception 'Friendship participants are immutable'; end if;
  if new.status is distinct from old.status then
   if not (new.status='blocked' and auth.uid() in (old.requester_id,old.addressee_id)) and not (old.status='pending' and auth.uid()=old.addressee_id and new.status in ('accepted','declined')) then raise exception 'Only the recipient can accept or decline a pending request'; end if;
  end if;
  new.accepted_at:=case when old.status='pending' and new.status='accepted' then now() else old.accepted_at end;
 end if;return new;
end $$;
revoke all on function private.guard_friendship() from public,anon,authenticated;
create trigger enforce_friendship_consent before insert or update on public.social_friendships for each row execute function private.guard_friendship();

-- Personal historical XP is preserved; competition starts with a separate server-owned ledger.
alter table public.social_profiles add column if not exists competitive_points bigint not null default 0;
alter table public.social_profiles add column if not exists competitive_missions integer not null default 0;
alter table public.social_profiles add column if not exists competitive_streak integer not null default 0;
alter table public.social_profiles add column if not exists title text;
alter table public.social_profiles add column if not exists gates integer not null default 0;
alter table public.social_profiles add column if not exists critical_hits integer not null default 0;
alter table public.social_profiles add column if not exists best_score integer not null default 0;
alter table public.social_profiles add column if not exists highest_boss text;
create index social_profiles_competitive_points_idx on public.social_profiles(competitive_points desc);
create function private.guard_competitive_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('anon','authenticated') then
  if tg_op='INSERT' then
   if (new.xp,new.missions,new.streak,new.competitive_points,new.competitive_missions,new.competitive_streak) is distinct from (0::bigint,0,0,0::bigint,0,0) then raise exception 'Competitive scores are server-managed';end if;
  elsif (new.xp,new.missions,new.streak,new.competitive_points,new.competitive_missions,new.competitive_streak) is distinct from (old.xp,old.missions,old.streak,old.competitive_points,old.competitive_missions,old.competitive_streak) then raise exception 'Competitive scores are server-managed';end if;
 end if;return new;
end $$;
revoke all on function private.guard_competitive_profile() from public,anon,authenticated;
create trigger enforce_competitive_scores before insert or update on public.social_profiles for each row execute function private.guard_competitive_profile();
create view public.competitive_profiles with (security_invoker=true) as select user_id,display_name,competitive_points as xp,level,rank,competitive_missions as missions,competitive_streak as streak,title,gates,critical_hits,best_score,highest_boss,updated_at from public.social_profiles;
grant select on public.competitive_profiles to authenticated;
revoke all on public.competitive_profiles from anon;

create table private.workout_credits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 credit_day date not null, mode text not null check(mode in ('full','light','intense')),
 started_at timestamptz not null default now(), completed_at timestamptz, points integer not null default 0 check(points between 0 and 100),
 unique(user_id,credit_day)
);
alter table private.workout_credits enable row level security;
revoke all on private.workout_credits from public,anon,authenticated;
create function private.workout_credit(action text, mode text default 'full', credit_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();entry private.workout_credits;credit_total bigint;credit_count integer;credit_streak integer;last_day date;
begin
 if uid is null then raise exception 'Sign in first';end if;
 if not exists(select 1 from public.social_profiles where user_id=uid) then raise exception 'Create your social profile first';end if;
 if action='start' then
  if mode not in ('full','light','intense') or mode is null then raise exception 'Invalid workout mode';end if;
  insert into private.workout_credits(user_id,credit_day,mode) values(uid,(now() at time zone 'UTC')::date,mode) on conflict(user_id,credit_day) do nothing;
  select * into entry from private.workout_credits where user_id=uid and credit_day=(now() at time zone 'UTC')::date;
 elsif action='complete' then
  -- A row lock makes retries/concurrent finishes award exactly once.
  select * into entry from private.workout_credits where id=credit_id and user_id=uid for update;
  if entry.id is null then raise exception 'Workout credit not found';end if;
  if entry.completed_at is null then
   if now()<entry.started_at+interval '60 seconds' then raise exception 'Workout credit requires at least one minute';end if;
   if now()>entry.started_at+interval '24 hours' then raise exception 'Workout credit expired';end if;
   update private.workout_credits set completed_at=now(),points=case entry.mode when 'full' then 100 when 'intense' then 70 else 40 end where id=entry.id returning * into entry;
   select coalesce(sum(points),0),count(*)::integer,max(credit_day) into credit_total,credit_count,last_day from private.workout_credits where user_id=uid and completed_at is not null;
   select count(*)::integer into credit_streak from (select credit_day,row_number() over(order by credit_day desc)::integer as position from private.workout_credits where user_id=uid and completed_at is not null) days where credit_day=last_day-(position-1);
   update public.social_profiles set competitive_points=credit_total,competitive_missions=credit_count,competitive_streak=credit_streak,updated_at=now() where user_id=uid;
  end if;
 else raise exception 'Unknown workout credit action';end if;
 return jsonb_build_object('id',entry.id,'user_id',uid,'mode',entry.mode,'points',entry.points,'completed',entry.completed_at is not null);
end $$;
revoke all on function private.workout_credit(text,text,uuid) from public,anon;
grant execute on function private.workout_credit(text,text,uuid) to authenticated;
create function public.workout_credit(action text, mode text default 'full', credit_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.workout_credit(action,mode,credit_id) $$;
revoke all on function public.workout_credit(text,text,uuid) from public,anon;
grant execute on function public.workout_credit(text,text,uuid) to authenticated;

-- Compute a metric as of a server timestamp so late finalization cannot count later workouts.
create function private.competition_metric(target uuid, metric text, cutoff timestamptz) returns bigint language sql stable set search_path='' as $$
 with credits as (select points,credit_day from private.workout_credits where user_id=target and completed_at<=cutoff),
 days as (select credit_day,row_number() over(order by credit_day desc)::integer as position,max(credit_day) over() as last_day from credits)
 select case metric when 'xp' then (select coalesce(sum(points),0) from credits)
 when 'workouts' then (select count(*) from credits)
 else (select count(*) from days where last_day>=(cutoff at time zone 'UTC')::date-1 and credit_day=last_day-(position-1)) end
$$;
revoke all on function private.competition_metric(uuid,text,timestamptz) from public,anon,authenticated;

-- Duels use server-owned metrics and server timestamps; callers cannot invent results.
create function private.guard_duel() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();a public.social_profiles;b public.social_profiles;av bigint;bv bigint;
begin
 select * into a from public.social_profiles where user_id=new.challenger_id;select * into b from public.social_profiles where user_id=new.opponent_id;
 if tg_op='INSERT' then
  if uid is distinct from new.challenger_id or new.status<>'pending' then raise exception 'Duels must start pending';end if;
  new.created_at:=now();new.accepted_at:=null;new.completed_at:=null;new.result:=null;new.challenger_final:=null;new.opponent_final:=null;new.challenger_start:=0;new.opponent_start:=0;
 else
  if (new.challenger_id,new.opponent_id,new.type,new.duration_days,new.created_at) is distinct from (old.challenger_id,old.opponent_id,old.type,old.duration_days,old.created_at) then raise exception 'Duel participants and rules are immutable';end if;
  new.challenger_start:=old.challenger_start;new.opponent_start:=old.opponent_start;new.accepted_at:=old.accepted_at;new.completed_at:=old.completed_at;new.challenger_final:=old.challenger_final;new.opponent_final:=old.opponent_final;new.result:=old.result;
  if new.status is distinct from old.status then
   if old.status='pending' and new.status in ('active','declined') then
    if uid is distinct from old.opponent_id then raise exception 'Only the recipient can respond';end if;
    if new.status='active' then
     new.accepted_at:=now();new.challenger_start:=private.competition_metric(new.challenger_id,new.type,now());new.opponent_start:=private.competition_metric(new.opponent_id,new.type,now());
    end if;
   elsif old.status='active' and new.status='completed' then
    if now()<old.accepted_at+make_interval(days=>old.duration_days) then raise exception 'Duel has not ended';end if;
    av:=private.competition_metric(new.challenger_id,new.type,old.accepted_at+make_interval(days=>old.duration_days));bv:=private.competition_metric(new.opponent_id,new.type,old.accepted_at+make_interval(days=>old.duration_days));
    new.challenger_final:=greatest(0,coalesce(av,0)-old.challenger_start);new.opponent_final:=greatest(0,coalesce(bv,0)-old.opponent_start);new.result:=case when new.challenger_final=new.opponent_final then 'draw' when new.challenger_final>new.opponent_final then 'challenger' else 'opponent' end;new.completed_at:=now();
   elsif new.status='cancelled' and old.status in ('pending','active') then null;
   else raise exception 'Invalid duel transition';end if;
  end if;
 end if;return new;
end $$;
revoke all on function private.guard_duel() from public,anon,authenticated;
create trigger enforce_duel_results before insert or update on public.social_challenges for each row execute function private.guard_duel();

-- Trigger functions are invoked by PostgreSQL, not by API clients.
do $$ declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('rls_auto_enable','system_duel_alert','system_friend_alert','system_squad_duel_alert') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f);
 end loop;
end $$;
-- Squad challenge results follow the same immutable rules and server-owned points.
create function private.guard_squad_duel() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();a_owner uuid;b_owner uuid;av bigint;bv bigint;
begin
 select owner_id into a_owner from public.social_squads where id=new.challenger_squad_id;select owner_id into b_owner from public.social_squads where id=new.opponent_squad_id;
 if tg_op='INSERT' then
  if uid is distinct from a_owner or uid is distinct from new.created_by or new.status<>'pending' then raise exception 'Only the squad owner can issue a pending challenge';end if;
  new.created_at:=now();new.accepted_at:=null;new.completed_at:=null;new.challenger_start:=0;new.opponent_start:=0;new.challenger_final:=null;new.opponent_final:=null;new.result:=null;
 else
  if (new.challenger_squad_id,new.opponent_squad_id,new.created_by,new.type,new.duration_days,new.created_at) is distinct from (old.challenger_squad_id,old.opponent_squad_id,old.created_by,old.type,old.duration_days,old.created_at) then raise exception 'Squad challenge participants and rules are immutable';end if;
  new.challenger_start:=old.challenger_start;new.opponent_start:=old.opponent_start;new.accepted_at:=old.accepted_at;new.completed_at:=old.completed_at;new.challenger_final:=old.challenger_final;new.opponent_final:=old.opponent_final;new.result:=old.result;
  if new.status is distinct from old.status then
   if old.status='pending' and new.status in ('active','declined') then
    if uid is distinct from b_owner then raise exception 'Only the receiving squad owner can respond';end if;
    if new.status='active' then
     select coalesce(sum(private.competition_metric(p.user_id,new.type,now())),0) into av from public.social_profiles p join public.social_squad_members m on m.user_id=p.user_id where m.squad_id=new.challenger_squad_id;
     select coalesce(sum(private.competition_metric(p.user_id,new.type,now())),0) into bv from public.social_profiles p join public.social_squad_members m on m.user_id=p.user_id where m.squad_id=new.opponent_squad_id;
     new.accepted_at:=now();new.challenger_start:=av;new.opponent_start:=bv;
    end if;
   elsif old.status='active' and new.status='completed' then
    if now()<old.accepted_at+make_interval(days=>old.duration_days) then raise exception 'Squad challenge has not ended';end if;
    select coalesce(sum(private.competition_metric(p.user_id,new.type,old.accepted_at+make_interval(days=>old.duration_days))),0) into av from public.social_profiles p join public.social_squad_members m on m.user_id=p.user_id where m.squad_id=new.challenger_squad_id;
    select coalesce(sum(private.competition_metric(p.user_id,new.type,old.accepted_at+make_interval(days=>old.duration_days))),0) into bv from public.social_profiles p join public.social_squad_members m on m.user_id=p.user_id where m.squad_id=new.opponent_squad_id;
    new.challenger_final:=greatest(0,av-old.challenger_start);new.opponent_final:=greatest(0,bv-old.opponent_start);new.completed_at:=now();new.result:=case when new.challenger_final=new.opponent_final then 'draw' when new.challenger_final>new.opponent_final then 'challenger' else 'opponent' end;
   elsif new.status='cancelled' and old.status in ('pending','active') then null;
   else raise exception 'Invalid squad challenge transition';end if;
  end if;
 end if;return new;
end $$;
revoke all on function private.guard_squad_duel() from public,anon,authenticated;
create trigger enforce_squad_duel_results before insert or update on public.social_squad_challenges for each row execute function private.guard_squad_duel();
