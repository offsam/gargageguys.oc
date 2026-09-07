-- Durable rate limiting for public endpoints (/api/callback, /api/ai-chat).
-- The previous limiter was an in-memory Map — useless on Vercel serverless,
-- since each cold start / instance gets its own empty counter. This table +
-- function give every instance a shared, atomic counter instead.
-- Only the service role touches this table, so RLS is enabled with no
-- policies: the anon key can never read or write it directly.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits;
begin
  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case
          when public.rate_limits.reset_at <= v_now then 1
          else public.rate_limits.count + 1
        end,
        reset_at = case
          when public.rate_limits.reset_at <= v_now
            then v_now + make_interval(secs => p_window_seconds)
          else public.rate_limits.reset_at
        end
  returning * into v_row;

  if v_row.count > p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
