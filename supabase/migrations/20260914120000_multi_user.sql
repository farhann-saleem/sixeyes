-- Marketing Studio multi-user (profiles + owned metadata).
-- Media binaries stay on disk/R2. Backend uses service DATABASE_URL / service role.
-- RLS is not relied on for MVP — do not expose these tables via anon key without RLS.

create extension if not exists "pgcrypto";

do $$ begin
  create type "GenerationStatus" as enum (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  picture text not null default '',
  tier text not null default 'free',
  tier_expires_at timestamptz,
  month_key text not null default '',
  usage_avatars int not null default 0,
  usage_images int not null default 0,
  usage_videos int not null default 0,
  usage_documentaries int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists billing_orders (
  id text primary key,
  profile_id uuid references profiles(id) on delete set null,
  email text not null,
  tier text not null,
  amount_pkr int not null,
  status text not null default 'pending',
  order_id text,
  granted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists billing_orders_email_idx on billing_orders (email);

create table if not exists avatar_jobs (
  id text primary key,
  owner_email text not null,
  status "GenerationStatus" not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists avatar_jobs_owner_updated_idx on avatar_jobs (owner_email, updated_at);

create table if not exists swap_jobs (
  id text primary key,
  owner_email text not null,
  status "GenerationStatus" not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists swap_jobs_owner_updated_idx on swap_jobs (owner_email, updated_at);

create table if not exists audio_jobs (
  id text primary key,
  owner_email text not null,
  status "GenerationStatus" not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audio_jobs_owner_updated_idx on audio_jobs (owner_email, updated_at);

create table if not exists identities (
  id text primary key,
  owner_email text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists identities_owner_created_idx on identities (owner_email, created_at);

create table if not exists studio_projects (
  id text primary key,
  owner_email text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_projects_owner_updated_idx on studio_projects (owner_email, updated_at);

create table if not exists studio_uploads (
  id text primary key,
  owner_email text not null,
  project_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists studio_uploads_owner_created_idx on studio_uploads (owner_email, created_at);
create index if not exists studio_uploads_project_idx on studio_uploads (project_id);

create table if not exists studio_renders (
  id text primary key,
  owner_email text not null,
  project_id text not null,
  status "GenerationStatus" not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_renders_owner_created_idx on studio_renders (owner_email, created_at);
create index if not exists studio_renders_project_idx on studio_renders (project_id);

create table if not exists cost_ledger (
  id text primary key default gen_random_uuid()::text,
  owner_email text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists cost_ledger_owner_created_idx on cost_ledger (owner_email, created_at);
