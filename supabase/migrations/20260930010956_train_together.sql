-- Only workout definitions and readiness are shared. Personal metrics remain private.
create table public.training_sessions (
 id uuid primary key default gen_random_uuid(),
 code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 host_id uuid not null references auth.users(id) on delete cascade,
 guest_id uuid references auth.users(id) on delete cascade,
 mission jsonb not null,
 total_sets integer not null check(total_sets between 1 and 500),
 cursor integer not null default 0,
 host_done integer not null default -1,
 guest_done integer not null default -1,
 status text not null default 'waiting' check(status in ('waiting','active','completed','cancelled')),
 expires_at timestamptz not null default now()+interval '4 hours',
 check(guest_id is null or guest_id<>host_id)
);
alter table public.training_sessions enable row level security;
revoke all on public.training_sessions from anon, authenticated;
grant select on public.training_sessions to authenticated;
create policy "session participants read" on public.training_sessions for select to authenticated
 using(auth.uid() in (host_id,guest_id));
-- RPCs are the sole mutation path, enforcing membership, capacity and atomic advancement.
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.training_session(action text, session_id uuid default null, join_code text default null, workout jsonb default null, set_index integer default null)
returns public.training_sessions language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.training_sessions; n integer;
begin
 if u is null then raise exception 'Sign in to train together'; end if;
 if action='host' then
  if jsonb_typeof(workout->'exercises') is distinct from 'array' or jsonb_array_length(workout->'exercises')=0 then raise exception 'Invalid workout'; end if;
  if exists(select 1 from jsonb_array_elements(workout->'exercises') e where jsonb_typeof(e)<>'array' or jsonb_array_length(e)<3 or (e->>1)::integer not between 1 and 50 or length(e->>0) not between 1 and 200) then raise exception 'Invalid exercise'; end if;
  select sum((e->>1)::integer) into n from jsonb_array_elements(workout->'exercises') e;
  insert into public.training_sessions(host_id,mission,total_sets) values(u,workout,n) returning * into s;
  return s;
 end if;
 if action='join' then
  select * into s from public.training_sessions where code=upper(trim(join_code)) for update;
 else
  select * into s from public.training_sessions where id=session_id for update;
 end if;
 if s.id is null then raise exception 'Session not found'; end if;
 if action='join' then
  if s.expires_at<=now() or s.status not in ('waiting','active') then raise exception 'Session expired or closed'; end if;
  if u=s.host_id or u=s.guest_id then return s; end if;
  if s.guest_id is not null then raise exception 'Session is full'; end if;
  update public.training_sessions set guest_id=u,status='active' where id=s.id returning * into s;
  return s;
 end if;
 if u is distinct from s.host_id and u is distinct from s.guest_id then raise exception 'Not a participant'; end if;
 if action='leave' then
  update public.training_sessions set status='cancelled' where id=s.id and status in ('waiting','active') returning * into s;
  return s;
 end if;
 if action<>'complete' then raise exception 'Unknown session action'; end if;
 if s.expires_at<=now() then raise exception 'Session expired'; end if;
 -- Retried submissions are idempotent, including the final set.
 if set_index<s.cursor then return s; end if;
 if s.status<>'active' or set_index is distinct from s.cursor then raise exception 'Session is not ready for this set'; end if;
 if u=s.host_id then s.host_done:=set_index; else s.guest_done:=set_index; end if;
 if s.host_done=s.cursor and s.guest_done=s.cursor then s.cursor:=s.cursor+1; end if;
 update public.training_sessions set host_done=s.host_done,guest_done=s.guest_done,cursor=s.cursor,
 status=case when s.cursor=s.total_sets then 'completed' else 'active' end where id=s.id returning * into s;
 return s;
end; $$;
revoke all on function private.training_session(text,uuid,text,jsonb,integer) from public,anon;
grant execute on function private.training_session(text,uuid,text,jsonb,integer) to authenticated;
create function public.training_session(action text, session_id uuid default null, join_code text default null, workout jsonb default null, set_index integer default null)
returns public.training_sessions language sql security invoker set search_path='' as $$
 select * from private.training_session(action,session_id,join_code,workout,set_index);
$$;
revoke all on function public.training_session(text,uuid,text,jsonb,integer) from public,anon;
grant execute on function public.training_session(text,uuid,text,jsonb,integer) to authenticated;
