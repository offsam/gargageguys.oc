-- Ensure Sheet/CRM address lives on leads (website + BOS forms)
alter table public.leads
  add column if not exists address text;
