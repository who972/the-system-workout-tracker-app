-- THE SYSTEM // V29 Squad Competition
create table if not exists public.social_squad_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_squad_id uuid not null references public.social_squads(id) on delete cascade,
  opponent_squad_id uuid not null references public.social_squads(id) on delete cascade,
  challenger_name text not null,
  opponent_name text not null,
  type text not null check (type in ('xp','workouts')),
  duration_days integer not null check (duration_days in (1,3,7)),
  status text not null default 'pending' check (status in ('pending','active','declined','completed','cancelled')),
  challenger_start bigint not null default 0,
  opponent_start bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  check (challenger_squad_id <> opponent_squad_id)
);
create index if not exists social_squad_challenges_a_idx on public.social_squad_challenges(challenger_squad_id,created_at desc);
create index if not exists social_squad_challenges_b_idx on public.social_squad_challenges(opponent_squad_id,created_at desc);
alter table public.social_squad_challenges enable row level security;

drop policy if exists "members can read squad challenges" on public.social_squad_challenges;
create policy "members can read squad challenges" on public.social_squad_challenges for select to authenticated using (
 exists(select 1 from public.social_squad_members m where m.user_id=auth.uid() and m.squad_id in (challenger_squad_id,opponent_squad_id))
);
drop policy if exists "owners can issue squad challenges" on public.social_squad_challenges;
create policy "owners can issue squad challenges" on public.social_squad_challenges for insert to authenticated with check (
 created_by=auth.uid() and exists(select 1 from public.social_squads s where s.id=challenger_squad_id and s.owner_id=auth.uid())
);
drop policy if exists "squad owners can update challenges" on public.social_squad_challenges;
create policy "squad owners can update challenges" on public.social_squad_challenges for update to authenticated using (
 exists(select 1 from public.social_squads s where s.id in (challenger_squad_id,opponent_squad_id) and s.owner_id=auth.uid())
) with check (
 exists(select 1 from public.social_squads s where s.id in (challenger_squad_id,opponent_squad_id) and s.owner_id=auth.uid())
);
grant select,insert,update on public.social_squad_challenges to authenticated;
