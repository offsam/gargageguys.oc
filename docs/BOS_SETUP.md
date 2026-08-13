# Garage Guys BOS

Independent CRM / SERM / Dispatch / Finance / Field on **garageguysoc.com** — no AI Consult runtime dependency.

## Setup

1. Create a Supabase project.
2. Run [`supabase/migrations/202608130001_bos_core.sql`](../supabase/migrations/202608130001_bos_core.sql) in the SQL editor.
3. Copy [`.env.example`](../.env.example) → `.env.local` and fill keys.
4. Create staff users in Supabase Auth, then set roles in `profiles`:

```sql
update profiles set role = 'owner' where email = 'you@example.com';
-- roles: owner | office | dispatcher | accountant | technician
```

5. `npm install && npm run dev` → http://localhost:3010  
   - Marketing site: `/`  
   - Login: `/login` → role home

## Routes

| Path | Who |
|---|---|
| `/login` | everyone |
| `/owner` | owner overview |
| `/crm` | leads / customers / inbox |
| `/serm` | SEO snapshots (GSC + GA4) |
| `/dispatch` | job queue + assignment |
| `/finance` | invoices |
| `/field` | technician jobs |

## Public APIs (local)

- `POST /api/callback` — forms → Telegram + Twilio + CRM DB
- `POST /api/ai-chat` — Alex (Groq) → CRM on submit
- `GET/POST /api/seo-sync` — GSC/GA4 → `seo_snapshots` (cron)
- `POST /api/seo-metrics` — optional external SEO ingest
- `GET /api/analytics` — GA4 snippet

See [`PRODUCT_MAP.md`](./PRODUCT_MAP.md).
