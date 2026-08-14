-- Meta / Google ads metrics snapshots (spend, leads, CPL)
create table if not exists public.ads_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  period_start date not null,
  period_end date not null,
  account_id text,
  spend numeric,
  impressions bigint,
  clicks bigint,
  leads integer,
  cpl numeric,
  metrics jsonb not null default '{}'::jsonb,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (platform, period_start, period_end)
);

create index if not exists ads_snapshots_platform_period_idx
  on public.ads_snapshots (platform, period_end desc);

alter table public.ads_snapshots enable row level security;

drop policy if exists "ads_snapshots_all_auth" on public.ads_snapshots;
create policy "ads_snapshots_all_auth"
  on public.ads_snapshots for all to authenticated
  using (true)
  with check (true);
