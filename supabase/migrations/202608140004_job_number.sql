-- Human-readable Job # for jobs + invoices

create sequence if not exists public.job_number_seq start with 1001 increment by 1;

alter table public.jobs
  add column if not exists job_number integer;

alter table public.job_invoices
  add column if not exists job_number integer;

create unique index if not exists jobs_job_number_uidx
  on public.jobs (job_number)
  where job_number is not null;

create index if not exists job_invoices_job_number_idx
  on public.job_invoices (job_number);

-- Backfill existing jobs without a number
do $$
declare
  r record;
begin
  for r in
    select id from public.jobs where job_number is null order by created_at asc
  loop
    update public.jobs
      set job_number = nextval('public.job_number_seq')
      where id = r.id;
  end loop;
end $$;

-- Copy numbers onto existing invoices
update public.job_invoices ji
set job_number = j.job_number
from public.jobs j
where ji.job_id = j.id
  and ji.job_number is null
  and j.job_number is not null;

create or replace function public.jobs_assign_job_number()
returns trigger
language plpgsql
as $$
begin
  if new.job_number is null then
    new.job_number := nextval('public.job_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_assign_job_number_trg on public.jobs;
create trigger jobs_assign_job_number_trg
  before insert on public.jobs
  for each row
  execute function public.jobs_assign_job_number();

create or replace function public.ensure_job_number(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select job_number into n from public.jobs where id = p_job_id;
  if n is not null then
    return n;
  end if;

  update public.jobs
    set job_number = nextval('public.job_number_seq')
    where id = p_job_id
      and job_number is null
    returning job_number into n;

  if n is null then
    select job_number into n from public.jobs where id = p_job_id;
  end if;

  return n;
end;
$$;

grant execute on function public.ensure_job_number(uuid) to authenticated, service_role;
