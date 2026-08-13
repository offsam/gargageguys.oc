-- Garage Guys BOS — minimal single-tenant schema (no Canvas)
-- Apply in your Supabase project SQL editor or via supabase db push

create extension if not exists "pgcrypto";

-- Roles for post-login routing
create type public.app_role as enum (
  'owner',
  'office',
  'dispatcher',
  'accountant',
  'technician'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'office',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  zip text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_phone_idx on public.customers (phone);

create type public.lead_stage as enum (
  'new',
  'qualified',
  'scheduled',
  'in_progress',
  'completed',
  'won',
  'lost',
  'cancelled'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  name text,
  phone text,
  zip text,
  message text,
  source text not null default 'website',
  lead_type text,
  stage public.lead_stage not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  deal_title text,
  deal_price text,
  scheduled_at timestamptz,
  problem text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_stage_idx on public.leads (stage);
create index leads_created_at_idx on public.leads (created_at desc);

create type public.inbox_status as enum ('new', 'reviewed', 'done', 'ignored');

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  item_type text not null default 'lead',
  title text not null,
  body text,
  status public.inbox_status not null default 'new',
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inbox_items_status_idx on public.inbox_items (status);

create table public.seo_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  source text not null default 'seo-sync',
  search_console jsonb,
  ga4 jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (period_start, period_end)
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  messages jsonb not null default '[]'::jsonb,
  collected jsonb not null default '{}'::jsonb,
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.job_status as enum (
  'queued',
  'assigned',
  'en_route',
  'on_site',
  'done',
  'cancelled'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  technician_id uuid references public.profiles (id) on delete set null,
  title text not null,
  status public.job_status not null default 'queued',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  address text,
  zip text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_technician_idx on public.jobs (technician_id);
create index jobs_status_idx on public.jobs (status);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'paid',
  'void',
  'overdue'
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  amount_cents integer not null default 0,
  status public.invoice_status not null default 'draft',
  description text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup (role defaults to office; promote via SQL/dashboard)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'office')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.inbox_items enable row level security;
alter table public.seo_snapshots enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;

-- Authenticated staff can read/write operational data (single tenant)
create policy "profiles_select_own_or_staff"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id);

create policy "customers_all_auth"
  on public.customers for all to authenticated
  using (true) with check (true);

create policy "leads_all_auth"
  on public.leads for all to authenticated
  using (true) with check (true);

create policy "inbox_all_auth"
  on public.inbox_items for all to authenticated
  using (true) with check (true);

create policy "seo_all_auth"
  on public.seo_snapshots for all to authenticated
  using (true) with check (true);

create policy "jobs_all_auth"
  on public.jobs for all to authenticated
  using (true) with check (true);

create policy "invoices_all_auth"
  on public.invoices for all to authenticated
  using (true) with check (true);

-- Service role bypasses RLS for public webhooks (leads/chat/seo)
