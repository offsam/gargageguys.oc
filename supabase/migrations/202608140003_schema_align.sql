-- Garage Guys BOS — schema align (safe to re-run)
-- Fixes: leads.address missing → client/lead create errors; job_invoices; chat RLS

-- 1) Leads need address for Sheet / CRM / Field add-client
alter table public.leads
  add column if not exists address text;

-- 2) Field invoices (estimate → payment → signature)
create table if not exists public.job_invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  public_token uuid not null default gen_random_uuid() unique,
  status text not null default 'draft'
    check (status in (
      'draft',
      'estimate_ready',
      'estimate_confirmed',
      'payment_pending',
      'payment_confirmed',
      'signed',
      'complete'
    )),
  client_name text,
  client_phone text,
  client_address text,
  client_zip text,
  lines jsonb not null default '[]'::jsonb,
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  payment_type text,
  estimate_confirmed_at timestamptz,
  payment_confirmed_at timestamptz,
  signature_data text,
  signed_at timestamptz,
  completed_at timestamptz,
  finance_invoice_id uuid references public.invoices (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id)
);

create index if not exists job_invoices_job_idx on public.job_invoices (job_id);
create index if not exists job_invoices_token_idx on public.job_invoices (public_token);
create index if not exists job_invoices_status_idx on public.job_invoices (status);

alter table public.job_invoices enable row level security;

drop policy if exists "job_invoices_all_auth" on public.job_invoices;
create policy "job_invoices_all_auth"
  on public.job_invoices for all to authenticated
  using (true) with check (true);

-- 3) Chat sessions policy (was missing in core)
drop policy if exists "chat_sessions_all_auth" on public.chat_sessions;
create policy "chat_sessions_all_auth"
  on public.chat_sessions for all to authenticated
  using (true) with check (true);

-- 4) Reviews (if not applied yet)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_source') then
    create type public.review_source as enum ('google', 'thumbtack');
  end if;
end $$;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  source public.review_source not null,
  external_id text not null,
  author_name text,
  rating numeric(2,1),
  text text,
  posted_at timestamptz,
  owner_reply text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists reviews_source_posted_idx
  on public.reviews (source, posted_at desc nulls last);

create table if not exists public.review_snapshots (
  id uuid primary key default gen_random_uuid(),
  source public.review_source not null unique,
  rating numeric(2,1),
  review_count integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.review_snapshots enable row level security;

drop policy if exists "reviews_all_auth" on public.reviews;
create policy "reviews_all_auth"
  on public.reviews for all to authenticated
  using (true) with check (true);

drop policy if exists "review_snapshots_all_auth" on public.review_snapshots;
create policy "review_snapshots_all_auth"
  on public.review_snapshots for all to authenticated
  using (true) with check (true);
