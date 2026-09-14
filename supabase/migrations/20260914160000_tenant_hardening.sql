-- Backend Google sessions are not Supabase Auth JWTs. No browser role may read these tables.
-- The service role bypasses RLS; Express must always enforce owner filters.
do $$
declare t text;
begin
  foreach t in array array['profiles','sessions','billing_orders','avatar_jobs','swap_jobs','audio_jobs','identities','studio_projects','studio_uploads','studio_renders','cost_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
create table if not exists public.user_resources (
  id text not null,
  kind text not null,
  owner_email text not null,
  payload jsonb not null,
  primary key (kind, id)
);
create index if not exists user_resources_owner_idx on public.user_resources(owner_email, kind);
alter table public.user_resources enable row level security;
revoke all on table public.user_resources from anon, authenticated;
grant all on table public.user_resources to service_role;

-- Avoid lost usage increments and tier overwrites by concurrent jobs/payments.
create or replace function public.record_usage(p_email text, p_kind text, p_month text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('avatars','images','videos','documentaries') then raise exception 'Invalid quota'; end if;
  update profiles set
    usage_avatars = (case when month_key = p_month then usage_avatars else 0 end) + (p_kind = 'avatars')::int,
    usage_images = (case when month_key = p_month then usage_images else 0 end) + (p_kind = 'images')::int,
    usage_videos = (case when month_key = p_month then usage_videos else 0 end) + (p_kind = 'videos')::int,
    usage_documentaries = (case when month_key = p_month then usage_documentaries else 0 end) + (p_kind = 'documentaries')::int,
    month_key = p_month, updated_at = now()
  where email = p_email;
  if not found then raise exception 'Profile not found'; end if;
end $$;
revoke all on function public.record_usage(text,text,text) from public, anon, authenticated;
grant execute on function public.record_usage(text,text,text) to service_role;

-- Mark paid and grant the tier in one transaction. Duplicate callbacks cannot re-grant.
create or replace function public.grant_paid_order(p_id text, p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare o billing_orders%rowtype;
begin
  select * into o from billing_orders where id = p_id for update;
  if not found or o.granted then return; end if;
  update profiles set tier = o.tier, tier_expires_at = now() + interval '30 days', updated_at = now() where email = o.email;
  if not found then raise exception 'Profile not found'; end if;
  update billing_orders set status = 'success', granted = true, order_id = p_order_id where id = p_id;
end $$;
revoke all on function public.grant_paid_order(text,text) from public, anon, authenticated;
grant execute on function public.grant_paid_order(text,text) to service_role;
