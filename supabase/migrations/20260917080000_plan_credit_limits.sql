-- Owner-run: stores plan allowances; does not change existing usage or payments.
begin;

create table if not exists public.plan_credit_limits (
  tier text primary key check (tier in ('free', 'pro', 'premium')),
  avatars integer not null check (avatars >= 0),
  images integer not null check (images >= 0),
  videos integer not null check (videos >= 0),
  documentaries integer not null check (documentaries >= 0),
  audio integer not null check (audio >= 0),
  requests_per_minute integer not null check (requests_per_minute > 0)
);

insert into public.plan_credit_limits
  (tier, avatars, images, videos, documentaries, audio, requests_per_minute)
values
  ('free', 1, 5, 3, 10, 300, 6),
  ('pro', 30, 100, 30, 200, 5000, 30),
  ('premium', 300, 1000, 300, 2000, 50000, 60)
on conflict (tier) do update set
  avatars = excluded.avatars,
  images = excluded.images,
  videos = excluded.videos,
  documentaries = excluded.documentaries,
  audio = excluded.audio,
  requests_per_minute = excluded.requests_per_minute;

alter table public.plan_credit_limits enable row level security;
revoke all on public.plan_credit_limits from public, anon, authenticated;
grant select on public.plan_credit_limits to service_role;

-- One row per person and credit category. Expired paid plans use Free limits.
-- Audio usage remains unknown here until the server ledger is migrated.
create or replace view public.user_credit_balances
with (security_invoker = true) as
select p.email, l.tier as effective_tier,
  to_char(now() at time zone 'UTC', 'YYYY-MM') as month_key,
  c.credit_type, c.monthly_limit,
  c.used,
  case when c.used is null then null
    else greatest(c.monthly_limit - c.used, 0) end as remaining,
  l.requests_per_minute
from public.profiles p
join public.plan_credit_limits l on l.tier =
  case when p.tier in ('pro', 'premium') and p.tier_expires_at > now()
    then p.tier else 'free' end
cross join lateral (values
  ('avatars', l.avatars, case when p.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM') then p.usage_avatars else 0 end),
  ('images', l.images, case when p.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM') then p.usage_images else 0 end),
  ('videos', l.videos, case when p.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM') then p.usage_videos else 0 end),
  ('documentaries', l.documentaries, case when p.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM') then p.usage_documentaries else 0 end),
  ('audio', l.audio, null::integer)
) as c(credit_type, monthly_limit, used);

revoke all on public.user_credit_balances from public, anon, authenticated;
grant select on public.user_credit_balances to service_role;

commit;

select * from public.user_credit_balances order by email, credit_type;
