-- THE SYSTEM // V31 Notification hardening
-- Cross-user alerts are created by database triggers so clients never need permission
-- to insert notifications for another account.

create or replace function public.system_friend_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.system_notifications(user_id,type,title,body,source_id,action_module)
  values(new.addressee_id,'friend','FRIEND LINK REQUEST',new.requester_name||' wants to connect.',new.id::text,'social');
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='accepted' then
  insert into public.system_notifications(user_id,type,title,body,source_id,action_module)
  values(new.requester_id,'friend','FRIEND LINK ACCEPTED',new.addressee_name||' accepted your friend request.',new.id::text,'social');
 end if; return new;
end $$;
drop trigger if exists system_friend_alert_trigger on public.social_friendships;
create trigger system_friend_alert_trigger after insert or update on public.social_friendships for each row execute function public.system_friend_alert();

create or replace function public.system_duel_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.system_notifications(user_id,type,title,body,source_id,action_module)
  values(new.opponent_id,'duel','DUEL CHALLENGE INCOMING',new.challenger_name||' issued a challenge.',new.id::text,'social');
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='active' then
  insert into public.system_notifications(user_id,type,title,body,source_id,action_module)
  values(new.challenger_id,'duel','DUEL ACCEPTED',new.opponent_name||' accepted your challenge.',new.id::text,'social');
 end if; return new;
end $$;
drop trigger if exists system_duel_alert_trigger on public.social_challenges;
create trigger system_duel_alert_trigger after insert or update on public.social_challenges for each row execute function public.system_duel_alert();

create or replace function public.system_squad_duel_alert()
returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if tg_op='INSERT' then
  select owner_id into target from public.social_squads where id=new.opponent_squad_id;
  if target is not null then insert into public.system_notifications(user_id,type,title,body,source_id,action_module) values(target,'squad','SQUAD CHALLENGE INCOMING',new.challenger_name||' challenged your squad.',new.id::text,'social'); end if;
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='active' then
  select owner_id into target from public.social_squads where id=new.challenger_squad_id;
  if target is not null then insert into public.system_notifications(user_id,type,title,body,source_id,action_module) values(target,'squad','SQUAD CHALLENGE ACCEPTED',new.opponent_name||' accepted the operation.',new.id::text,'social'); end if;
 end if; return new;
end $$;
drop trigger if exists system_squad_duel_alert_trigger on public.social_squad_challenges;
create trigger system_squad_duel_alert_trigger after insert or update on public.social_squad_challenges for each row execute function public.system_squad_duel_alert();
