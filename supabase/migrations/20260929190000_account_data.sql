-- Separate progress reset and verified account deletion. Both are transactional.
create table if not exists public.workout_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.workout_backups enable row level security;
drop policy if exists "own workout backups" on public.workout_backups;
create policy "own workout backups" on public.workout_backups for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.workout_backups to authenticated;

create or replace function public.reset_my_progress(replacement jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if replacement->>'app' is distinct from 'The System - Workout Tracker'
    or jsonb_typeof(replacement->'localStorage') is distinct from 'object' then
    raise exception 'Invalid reset snapshot';
  end if;
  insert into public.workout_backups(user_id,data,updated_at) values(uid,replacement,now())
    on conflict(user_id) do update set data=excluded.data,updated_at=excluded.updated_at;
  update public.social_profiles set xp=0,level=1,rank='E-Rank',missions=0,streak=0,updated_at=now() where user_id=uid;
  delete from public.system_notifications where user_id=uid and type='progress';
  -- Cancel ongoing duels so a reset cannot produce negative deltas. Past results stay historical.
  update public.social_challenges set status='cancelled' where (challenger_id=uid or opponent_id=uid) and status in ('pending','active');
end;
$$;
revoke all on function public.reset_my_progress(jsonb) from public,anon;
grant execute on function public.reset_my_progress(jsonb) to authenticated;

-- Only the password-verifying Edge Function may call this RPC.
create or replace function public.delete_verified_account(target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_user is null then raise exception 'Account required'; end if;
  -- Explicit deletion also supports older workout_backups tables without a cascade FK.
  delete from public.workout_backups where user_id=target_user;
  delete from auth.users where id=target_user;
  if not found then raise exception 'Account not found'; end if;
  -- Social profiles, friendships, challenges, squads, membership and notifications cascade.
end;
$$;
revoke all on function public.delete_verified_account(uuid) from public,anon,authenticated;
grant execute on function public.delete_verified_account(uuid) to service_role;
