-- THE SYSTEM // V35 Competitive result snapshots
alter table public.social_challenges add column if not exists challenger_final bigint;
alter table public.social_challenges add column if not exists opponent_final bigint;
alter table public.social_challenges add column if not exists completed_at timestamptz;
alter table public.social_challenges add column if not exists result text check (result in ('challenger','opponent','draw'));

alter table public.social_squad_challenges add column if not exists challenger_final bigint;
alter table public.social_squad_challenges add column if not exists opponent_final bigint;
alter table public.social_squad_challenges add column if not exists completed_at timestamptz;
alter table public.social_squad_challenges add column if not exists result text check (result in ('challenger','opponent','draw'));

comment on column public.social_challenges.challenger_final is 'Final challenger delta captured when duel expires.';
comment on column public.social_challenges.opponent_final is 'Final opponent delta captured when duel expires.';
comment on column public.social_squad_challenges.challenger_final is 'Final challenger squad delta captured when operation expires.';
comment on column public.social_squad_challenges.opponent_final is 'Final opponent squad delta captured when operation expires.';
