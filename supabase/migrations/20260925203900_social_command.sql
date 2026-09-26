-- THE SYSTEM // Social Command cloud schema
-- Run with Supabase migrations or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  rank text not null default 'E-Rank',
  missions integer not null default 0 check (missions >= 0),
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_profiles_display_name_lower_idx
  on public.social_profiles (lower(display_name));
create index if not exists social_profiles_xp_idx
  on public.social_profiles (xp desc);

create table if not exists public.social_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  challenger_name text not null,
  opponent_name text not null,
  type text not null check (type in ('xp','workouts','streak')),
  duration_days integer not null check (duration_days in (1,3,7)),
  status text not null default 'pending' check (status in ('pending','active','declined','completed','cancelled')),
  challenger_start bigint not null default 0 check (challenger_start >= 0),
  opponent_start bigint not null default 0 check (opponent_start >= 0),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  check (challenger_id <> opponent_id)
);

create index if not exists social_challenges_challenger_idx on public.social_challenges (challenger_id, created_at desc);
create index if not exists social_challenges_opponent_idx on public.social_challenges (opponent_id, created_at desc);

alter table public.social_profiles enable row level security;
alter table public.social_challenges enable row level security;

drop policy if exists "authenticated users can read leaderboard profiles" on public.social_profiles;
create policy "authenticated users can read leaderboard profiles"
on public.social_profiles for select
to authenticated
using (true);

drop policy if exists "users can insert own social profile" on public.social_profiles;
create policy "users can insert own social profile"
on public.social_profiles for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own social profile" on public.social_profiles;
create policy "users can update own social profile"
on public.social_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "challenge participants can read challenges" on public.social_challenges;
create policy "challenge participants can read challenges"
on public.social_challenges for select
to authenticated
using (auth.uid() = challenger_id or auth.uid() = opponent_id);

drop policy if exists "users can create challenges as themselves" on public.social_challenges;
create policy "users can create challenges as themselves"
on public.social_challenges for insert
to authenticated
with check (auth.uid() = challenger_id and challenger_id <> opponent_id);

drop policy if exists "challenge participants can update challenges" on public.social_challenges;
create policy "challenge participants can update challenges"
on public.social_challenges for update
to authenticated
using (auth.uid() = challenger_id or auth.uid() = opponent_id)
with check (
  auth.uid() = challenger_id or auth.uid() = opponent_id
);

grant select, insert, update on public.social_profiles to authenticated;
grant select, insert, update on public.social_challenges to authenticated;

comment on table public.social_profiles is 'Public competitive profile data for THE SYSTEM Social Command.';
comment on table public.social_challenges is 'Private head-to-head challenge records visible only to participants.';
