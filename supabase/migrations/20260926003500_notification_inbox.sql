-- THE SYSTEM // V30 Notification Inbox
create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('friend','duel','squad','boss','progress','system')),
  title text not null,
  body text not null default '',
  source_id text,
  action_module text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists system_notifications_user_idx on public.system_notifications(user_id,created_at desc);
create index if not exists system_notifications_unread_idx on public.system_notifications(user_id,read_at) where read_at is null;
alter table public.system_notifications enable row level security;
drop policy if exists "users can read own notifications" on public.system_notifications;
create policy "users can read own notifications" on public.system_notifications for select to authenticated using(auth.uid()=user_id);
drop policy if exists "users can create own notifications" on public.system_notifications;
create policy "users can create own notifications" on public.system_notifications for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "users can update own notifications" on public.system_notifications;
create policy "users can update own notifications" on public.system_notifications for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "users can delete own notifications" on public.system_notifications;
create policy "users can delete own notifications" on public.system_notifications for delete to authenticated using(auth.uid()=user_id);
grant select,insert,update,delete on public.system_notifications to authenticated;
