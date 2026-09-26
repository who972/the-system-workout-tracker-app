-- THE SYSTEM // V28 Friends + Squads
create table if not exists public.social_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null,
  addressee_name text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists social_friendships_pair_idx on public.social_friendships (least(requester_id,addressee_id),greatest(requester_id,addressee_id));
create index if not exists social_friendships_requester_idx on public.social_friendships(requester_id,status);
create index if not exists social_friendships_addressee_idx on public.social_friendships(addressee_id,status);

create table if not exists public.social_squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists social_squads_name_lower_idx on public.social_squads(lower(name));

create table if not exists public.social_squad_members (
  squad_id uuid not null references public.social_squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (squad_id,user_id)
);
create index if not exists social_squad_members_user_idx on public.social_squad_members(user_id);

alter table public.social_friendships enable row level security;
alter table public.social_squads enable row level security;
alter table public.social_squad_members enable row level security;

drop policy if exists "friend participants can read" on public.social_friendships;
create policy "friend participants can read" on public.social_friendships for select to authenticated using (auth.uid()=requester_id or auth.uid()=addressee_id);
drop policy if exists "users can request friendship" on public.social_friendships;
create policy "users can request friendship" on public.social_friendships for insert to authenticated with check (auth.uid()=requester_id and requester_id<>addressee_id);
drop policy if exists "friend participants can update" on public.social_friendships;
create policy "friend participants can update" on public.social_friendships for update to authenticated using (auth.uid()=requester_id or auth.uid()=addressee_id) with check (auth.uid()=requester_id or auth.uid()=addressee_id);
drop policy if exists "friend participants can delete" on public.social_friendships;
create policy "friend participants can delete" on public.social_friendships for delete to authenticated using (auth.uid()=requester_id or auth.uid()=addressee_id);

drop policy if exists "authenticated users can read squads" on public.social_squads;
create policy "authenticated users can read squads" on public.social_squads for select to authenticated using (true);
drop policy if exists "users can create owned squads" on public.social_squads;
create policy "users can create owned squads" on public.social_squads for insert to authenticated with check (auth.uid()=owner_id);
drop policy if exists "owners can update squads" on public.social_squads;
create policy "owners can update squads" on public.social_squads for update to authenticated using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
drop policy if exists "owners can delete squads" on public.social_squads;
create policy "owners can delete squads" on public.social_squads for delete to authenticated using (auth.uid()=owner_id);

drop policy if exists "authenticated users can read squad members" on public.social_squad_members;
create policy "authenticated users can read squad members" on public.social_squad_members for select to authenticated using (true);
drop policy if exists "users can join squads as themselves" on public.social_squad_members;
create policy "users can join squads as themselves" on public.social_squad_members for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "members can leave squads" on public.social_squad_members;
create policy "members can leave squads" on public.social_squad_members for delete to authenticated using (auth.uid()=user_id or exists(select 1 from public.social_squads s where s.id=squad_id and s.owner_id=auth.uid()));

grant select,insert,update,delete on public.social_friendships to authenticated;
grant select,insert,update,delete on public.social_squads to authenticated;
grant select,insert,delete on public.social_squad_members to authenticated;
