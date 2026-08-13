-- Optional future: relational stock (app currently uses Storage bos-data/stock.json).
-- Apply in Supabase SQL Editor when ready to migrate off the JSON store.

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text not null,
  subcategory text,
  unit_cost_cents integer not null default 0,
  unit text not null default 'ea',
  reorder_at integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_items_category_idx on public.stock_items (category, name);

create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items (id) on delete cascade,
  location_type text not null check (location_type in ('warehouse', 'tech')),
  technician_id uuid references public.profiles (id) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  constraint stock_balances_location_check check (
    (location_type = 'warehouse' and technician_id is null)
    or (location_type = 'tech' and technician_id is not null)
  )
);

create unique index if not exists stock_balances_warehouse_uq
  on public.stock_balances (item_id) where location_type = 'warehouse';
create unique index if not exists stock_balances_tech_uq
  on public.stock_balances (item_id, technician_id) where location_type = 'tech';

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items (id) on delete cascade,
  qty integer not null check (qty > 0),
  kind text not null,
  from_location_type text,
  from_technician_id uuid references public.profiles (id) on delete set null,
  to_location_type text,
  to_technician_id uuid references public.profiles (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.stock_items enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists stock_items_auth_all on public.stock_items;
create policy stock_items_auth_all
  on public.stock_items for all to authenticated
  using (true) with check (true);

drop policy if exists stock_balances_auth_all on public.stock_balances;
create policy stock_balances_auth_all
  on public.stock_balances for all to authenticated
  using (true) with check (true);

drop policy if exists stock_movements_auth_all on public.stock_movements;
create policy stock_movements_auth_all
  on public.stock_movements for all to authenticated
  using (true) with check (true);
