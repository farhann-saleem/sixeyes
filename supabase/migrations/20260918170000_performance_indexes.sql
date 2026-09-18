-- Marketing Studio: Performance Optimization Indexes
-- Resolves unindexed foreign keys, eliminates table scans on status checks, and accelerates owner queries.

-- 1. Foreign Key Indexes (Eliminates table locks and scans on profile deletion/lookups)
create index if not exists sessions_profile_id_idx on public.sessions (profile_id);
create index if not exists billing_orders_profile_id_idx on public.billing_orders (profile_id);

-- 2. Status & Resume Query Indexes (Used by server boot resumeInFlight* and job pollers)
create index if not exists avatar_jobs_status_updated_idx on public.avatar_jobs (status, updated_at desc);
create index if not exists swap_jobs_status_updated_idx on public.swap_jobs (status, updated_at desc);
create index if not exists audio_jobs_status_updated_idx on public.audio_jobs (status, updated_at desc);
create index if not exists studio_renders_status_updated_idx on public.studio_renders (status, updated_at desc);
create index if not exists billing_orders_status_created_idx on public.billing_orders (status, created_at desc);

-- 3. Owner & Timeline Sorting Indexes (Eliminates filesorts on descending lists)
create index if not exists studio_projects_owner_created_idx on public.studio_projects (owner_email, created_at desc);
create index if not exists studio_projects_id_owner_idx on public.studio_projects (id, owner_email);
create index if not exists studio_renders_project_owner_idx on public.studio_renders (project_id, owner_email);
create index if not exists studio_uploads_project_owner_idx on public.studio_uploads (project_id, owner_email);
