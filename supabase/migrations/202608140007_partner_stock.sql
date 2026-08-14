-- Partner warehouse flag: own stock vs Garage Guys stock

alter table public.partners
  add column if not exists has_own_stock boolean not null default false;

comment on column public.partners.has_own_stock is
  'true = partner has their own warehouse; false = jobs use Garage Guys stock';
