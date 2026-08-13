-- Field job invoices: estimate → payment → signature → final document
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
