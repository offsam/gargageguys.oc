-- Close the gap left by 202608150001_role_aware_rls.sql: stock tables were still
-- `using (true) with check (true)` for every authenticated user, so any technician
-- could read/write another technician's truck stock or the warehouse balance directly
-- via the Supabase REST API (not just through the app UI).
-- Service role (webhooks, admin client) still bypasses RLS.

-- ── stock_items (catalog): everyone can read, only staff can manage it ──────
drop policy if exists stock_items_auth_all on public.stock_items;
drop policy if exists stock_items_read_all on public.stock_items;
drop policy if exists stock_items_write_staff on public.stock_items;

create policy stock_items_read_all
  on public.stock_items for select to authenticated
  using (true);

create policy stock_items_write_staff
  on public.stock_items for insert to authenticated
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

create policy stock_items_update_staff
  on public.stock_items for update to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

create policy stock_items_delete_staff
  on public.stock_items for delete to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']));

-- ── stock_balances: staff see/manage everything, techs only their own row ───
drop policy if exists stock_balances_auth_all on public.stock_balances;
drop policy if exists stock_balances_staff_all on public.stock_balances;
drop policy if exists stock_balances_tech_own on public.stock_balances;

create policy stock_balances_staff_all
  on public.stock_balances for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

create policy stock_balances_tech_own
  on public.stock_balances for select to authenticated
  using (
    public.current_app_role() = 'technician'
    and location_type = 'tech'
    and technician_id = auth.uid()
  );

-- ── stock_movements: staff full access, techs only movements that touch them ─
drop policy if exists stock_movements_auth_all on public.stock_movements;
drop policy if exists stock_movements_staff_all on public.stock_movements;
drop policy if exists stock_movements_tech_related on public.stock_movements;

create policy stock_movements_staff_all
  on public.stock_movements for all to authenticated
  using (public.has_app_role(array['owner', 'office', 'dispatcher']))
  with check (public.has_app_role(array['owner', 'office', 'dispatcher']));

create policy stock_movements_tech_related
  on public.stock_movements for select to authenticated
  using (
    public.current_app_role() = 'technician'
    and (from_technician_id = auth.uid() or to_technician_id = auth.uid())
  );

create policy stock_movements_tech_insert
  on public.stock_movements for insert to authenticated
  with check (
    public.current_app_role() = 'technician'
    and (from_technician_id = auth.uid() or to_technician_id = auth.uid())
    and created_by = auth.uid()
  );
