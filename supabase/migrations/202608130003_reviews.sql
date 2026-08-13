-- Reviews sync: Google Business / Thumbtack → site + CRM

create type public.review_source as enum ('google', 'thumbtack');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  source public.review_source not null,
  external_id text not null,
  author_name text,
  rating numeric(2,1),
  text text,
  posted_at timestamptz,
  owner_reply text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index reviews_source_posted_idx
  on public.reviews (source, posted_at desc nulls last);

create table public.review_snapshots (
  id uuid primary key default gen_random_uuid(),
  source public.review_source not null unique,
  rating numeric(2,1),
  review_count integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.review_snapshots enable row level security;

create policy "reviews_all_auth"
  on public.reviews for all to authenticated
  using (true) with check (true);

create policy "review_snapshots_all_auth"
  on public.review_snapshots for all to authenticated
  using (true) with check (true);

-- Public read for marketing site aggregates/cards (anon key)
create policy "reviews_public_read"
  on public.reviews for select to anon
  using (true);

create policy "review_snapshots_public_read"
  on public.review_snapshots for select to anon
  using (true);

-- Seed current Google Business reviews (static Phase 1 content)
insert into public.review_snapshots (source, rating, review_count, raw)
values
  ('google', 5.0, 7, '{"seed": true}'::jsonb),
  ('thumbtack', 5.0, 74, '{"seed": true}'::jsonb)
on conflict (source) do update
set
  rating = excluded.rating,
  review_count = excluded.review_count,
  synced_at = now(),
  updated_at = now();

insert into public.reviews (source, external_id, author_name, rating, text, posted_at, owner_reply, raw)
values
  ('google', 'seed-farzaneh-h', 'Farzaneh H.', 5.0, 'Reasonable price. Fix the garage door.', now() - interval '14 hours', 'Thank you', '{"seed": true}'::jsonb),
  ('google', 'seed-jose-g', 'Jose G.', 5.0, 'We found Sam on OfferUp and decided to give him a call. He was fast on getting there, checked out the issue and got to work on it fast and fixed it. Did a good job as well — I will definitely recommend him. Very respectful and professional.', now() - interval '1 day', null, '{"seed": true}'::jsonb),
  ('google', 'seed-thomas-h', 'Thomas H.', 5.0, 'Very professional and easy to work with. Were available within a few hours of reaching out and came fully prepared for any issue. Our garage had not been serviced in 25 years and had more work than expected — still handled it smoothly.', now() - interval '3 days', 'Thank you Thomas.', '{"seed": true}'::jsonb),
  ('google', 'seed-maribel-y', 'Maribel Y.', 5.0, 'Garage Guys did a good job with fair pricing and in a short time. My garage door was fixed within an hour. I highly recommend Garage Guys for repairing garage door.', now() - interval '7 days', null, '{"seed": true}'::jsonb),
  ('google', 'seed-hani-m', 'Hani M.', 5.0, 'We had an excellent experience with this garage door company from start to finish. They responded quickly, arrived on time, and clearly explained the issue with our garage door before beginning any work. The technician was professional and thorough.', now() - interval '7 days', 'Thank you', '{"seed": true}'::jsonb),
  ('google', 'seed-pull-team', 'PULL team', 5.0, '5 star service and communication. Technician explained everything before start working.', now() - interval '21 days', 'Thank you', '{"seed": true}'::jsonb),
  ('google', 'seed-kai-c', 'Kai C.', 5.0, 'Great price.', now() - interval '21 days', 'Thank you', '{"seed": true}'::jsonb)
on conflict (source, external_id) do nothing;
