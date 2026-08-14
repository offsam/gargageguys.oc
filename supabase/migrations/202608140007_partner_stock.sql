-- Partners table + own-stock flag (safe to run even if partners does not exist yet)

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  tech_percent numeric(5,2) not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partners
  add column if not exists has_own_stock boolean not null default false;

comment on column public.partners.has_own_stock is
  'true = partner has their own warehouse; false = jobs use Garage Guys stock';

create unique index if not exists partners_name_uidx
  on public.partners (lower(name));

create index if not exists partners_active_idx
  on public.partners (active, name);

alter table public.partners enable row level security;

drop policy if exists partners_select_staff on public.partners;
create policy partners_select_staff
  on public.partners for select to authenticated
  using (true);

drop policy if exists partners_write_owner on public.partners;
create policy partners_write_owner
  on public.partners for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

insert into public.partners (name, notes, tech_percent, has_own_stock)
select 'Champion Garage Doors Service', 'Default partner', 30, false
where not exists (
  select 1 from public.partners
  where lower(name) = lower('Champion Garage Doors Service')
);

-- Pick up the new table/column in the API without waiting
notify pgrst, 'reload schema';
