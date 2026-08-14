-- Job # format GG26-08001 = year 26, month 08, seq 001 (America/Los_Angeles)

create or replace function public.next_job_number_ym(p_at timestamptz default now())
returns integer
language plpgsql
as $$
declare
  yymm integer;
  seq integer;
begin
  yymm := to_char((p_at at time zone 'America/Los_Angeles'), 'YYMM')::integer;

  select coalesce(max(job_number % 1000), 0) + 1
    into seq
  from public.jobs
  where job_number is not null
    and job_number >= 1000000
    and job_number / 1000 = yymm;

  if seq > 999 then
    raise exception 'job number sequence overflow for YYMM %', yymm;
  end if;

  return yymm * 1000 + seq;
end;
$$;

create or replace function public.jobs_assign_job_number()
returns trigger
language plpgsql
as $$
begin
  if new.job_number is null then
    new.job_number := public.next_job_number_ym(coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

create or replace function public.ensure_job_number(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  created timestamptz;
begin
  select job_number, created_at into n, created
  from public.jobs
  where id = p_job_id;

  if not found then
    return null;
  end if;

  -- Keep modern YYMM numbers; replace legacy flat sequence (GG-1001…)
  if n is not null and n >= 1000000 then
    return n;
  end if;

  update public.jobs
  set job_number = public.next_job_number_ym(coalesce(created, now()))
  where id = p_job_id
  returning job_number into n;

  if n is null then
    select job_number into n from public.jobs where id = p_job_id;
  end if;

  return n;
end;
$$;

create or replace function public.renumber_all_job_numbers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer;
  cnt integer := 0;
begin
  -- Free unique index slots
  update public.job_invoices set job_number = null where job_number is not null;
  update public.jobs set job_number = null where job_number is not null;

  for r in
    select id, created_at
    from public.jobs
    where status is distinct from 'cancelled'
    order by created_at asc nulls last, id asc
  loop
    n := public.next_job_number_ym(coalesce(r.created_at, now()));
    update public.jobs set job_number = n where id = r.id;
    update public.job_invoices set job_number = n where job_id = r.id;
    cnt := cnt + 1;
  end loop;

  return cnt;
end;
$$;

grant execute on function public.next_job_number_ym(timestamptz) to authenticated, service_role;
grant execute on function public.ensure_job_number(uuid) to authenticated, service_role;
grant execute on function public.renumber_all_job_numbers() to service_role;
