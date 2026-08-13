# Schema sync checklist

If creating a client/lead fails with **address** or missing table errors, run this in Supabase SQL Editor:

[`supabase/migrations/202608140003_schema_align.sql`](../supabase/migrations/202608140003_schema_align.sql)

## Code expects

| Table | Extra vs original core |
|---|---|
| `leads.address` | Required for Sheet/CRM/Field |
| `job_invoices` | Field invoice + signature flow |
| `jobs.job_number` / `job_invoices.job_number` | Human Job # (`GG-1001`…) on invoices |
| `reviews` / `review_snapshots` | SERM / Overview review counts |
| `chat_sessions` RLS policy | AI chat |

Core tables from `202608130001_bos_core.sql` must already exist: `profiles`, `customers`, `leads`, `jobs`, `invoices`, `inbox_items`, etc.

Also run for Job # on invoices:

[`supabase/migrations/202608140004_job_number.sql`](../supabase/migrations/202608140004_job_number.sql)
