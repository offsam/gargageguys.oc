-- Role-aware RLS: technicians cannot read company-wide finance / marketing data.
-- Service role (webhooks, admin client) still bypasses RLS.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.has_app_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = any (allowed), false)
$$;

revoke all on function public.has_app_role(text[]) from public;
grant execute on function public.has_app_role(text[]) to authenticated;

-- ── invoices (company billing) ──────────────────────────────────────────────
drop policy if exists "invoices_all_auth" on public.invoices;
drop policy if exists invoices_finance_staff on public.invoices;
create policy invoices_finance_staff
  on public.invoices for all to authenticated
  using (public.has_app_role(array['owner', 'accountant']))
  with check (public.has_app_role(array['owner', 'accountant']));

-- ── ads / seo marketing snapshots ───────────────────────────────────────────
drop policy if exists "ads_snapshots_all_auth" on public.ads_snapshots;
drop policy if exists ads_snapshots_marketing on public.ads_snapshots;
create policy ads_snapshots_marketing
  on public.ads_snapshots for all to authenticated
  using (public.has_app_role(array['owner', 'office']))
  with check (public.has_app_role(array['owner', 'office']));

drop policy if exists "seo_all_auth" on public.seo_snapshots;
drop policy if exists seo_snapshots_marketing on public.seo_snapshots;
create policy seo_snapshots_marketing
  on public.seo_snapshots for all to authenticated
  using (public.has_app_role(array['owner', 'office']))
  with check (public.has_app_role(array['owner', 'office']));

drop policy if exists "reviews_all_auth" on public.reviews;
drop policy if exists reviews_marketing on public.reviews;
create policy reviews_marketing
  on public.reviews for all to authenticated
  using (public.has_app_role(array['owner', 'office']))
  with check (public.has_app_role(array['owner', 'office']));

drop policy if exists "review_snapshots_all_auth" on public.review_snapshots;
drop policy if exists review_snapshots_marketing on public.review_snapshots;
create policy review_snapshots_marketing
  on public.review_snapshots for all to authenticated
  using (public.has_app_role(array['owner', 'office']))
  with check (public.has_app_role(array['owner', 'office']));

-- ── jobs: technicians only their own ────────────────────────────────────────
drop policy if exists "jobs_all_auth" on public.jobs;
drop policy if exists jobs_staff_all on public.jobs;
drop policy if exists jobs_tech_own on public.jobs;

create policy jobs_staff_all
  on public.jobs for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']));

create policy jobs_tech_own
  on public.jobs for all to authenticated
  using (
    public.current_app_role() = 'technician'
    and technician_id = auth.uid()
  )
  with check (
    public.current_app_role() = 'technician'
    and technician_id = auth.uid()
  );

-- ── job_invoices: tech only for assigned jobs ───────────────────────────────
drop policy if exists "job_invoices_all_auth" on public.job_invoices;
drop policy if exists job_invoices_staff on public.job_invoices;
drop policy if exists job_invoices_tech_own on public.job_invoices;

create policy job_invoices_staff
  on public.job_invoices for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']));

create policy job_invoices_tech_own
  on public.job_invoices for all to authenticated
  using (
    public.current_app_role() = 'technician'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.technician_id = auth.uid()
    )
  )
  with check (
    public.current_app_role() = 'technician'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.technician_id = auth.uid()
    )
  );

-- ── leads / customers: no full CRM dump for technicians via API ─────────────
drop policy if exists "leads_all_auth" on public.leads;
drop policy if exists leads_staff_all on public.leads;
drop policy if exists leads_tech_related on public.leads;

create policy leads_staff_all
  on public.leads for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']));

create policy leads_tech_related
  on public.leads for select to authenticated
  using (
    public.current_app_role() = 'technician'
    and exists (
      select 1 from public.jobs j
      where j.lead_id = leads.id and j.technician_id = auth.uid()
    )
  );

drop policy if exists "customers_all_auth" on public.customers;
drop policy if exists customers_staff_all on public.customers;
drop policy if exists customers_tech_related on public.customers;

create policy customers_staff_all
  on public.customers for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher', 'accountant']));

create policy customers_tech_related
  on public.customers for select to authenticated
  using (
    public.current_app_role() = 'technician'
    and exists (
      select 1 from public.jobs j
      where j.customer_id = customers.id and j.technician_id = auth.uid()
    )
  );

-- ── inbox / chat: office+ (not field techs) ──────────────────────────────────
drop policy if exists "inbox_all_auth" on public.inbox_items;
drop policy if exists inbox_staff on public.inbox_items;
create policy inbox_staff
  on public.inbox_items for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

drop policy if exists "chat_sessions_all_auth" on public.chat_sessions;
drop policy if exists chat_sessions_staff on public.chat_sessions;
create policy chat_sessions_staff
  on public.chat_sessions for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

-- ── profiles: everyone can read (staff directory); only own row update ──────
-- (existing policies already allow select all / update own — leave as-is)
