# Google Reviews → site + CRM

## What ships

1. **Site UI** — Thumbtack slider on top, Google slider underneath; stats bar shows 74 | 7.
2. **Supabase** — `reviews` + `review_snapshots` ([supabase/migrations/202608130003_reviews.sql](../supabase/migrations/202608130003_reviews.sql)).
3. **Public API** — `GET /api/reviews` (aggregates for the marketing site).
4. **Cron** — `GET/POST /api/google-reviews-sync` every ~3 days (`vercel.json`).
5. **CRM** — `/serm` shows Google/Thumbtack counts + recent review rows.
6. **GBP OAuth** — `GET /api/auth/google-gbp` → callback prints refresh token for Vercel env.

## Setup (order)

### A. Database
Run migration `202608130003_reviews.sql` in Supabase SQL editor (or CLI).

### B. Places API (fast path — rating + count)
1. Google Cloud → enable **Places API (New)**.
2. Create API key → `GOOGLE_PLACES_API_KEY`.
3. Set `GOOGLE_PLACE_ID` (Place ID for Garage Guys Newport Beach).
4. Set Supabase URL + `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
5. Call once:  
   `curl -H "Authorization: Bearer $CRON_SECRET" https://garageguysoc.com/api/google-reviews-sync`

### C. Business Profile API (full reviews + replies → CRM inbox)
1. Google Cloud OAuth client (Web) — same client as Ads is fine (`GOOGLE_ADS_CLIENT_ID` / `SECRET`). Optional dedicated `GOOGLE_GBP_CLIENT_*`.
2. Enable **Google Business Profile API**, **My Business Account Management API**, and **My Business Business Information API**.
3. Add authorized redirect URI: `https://garageguysoc.com/api/auth/google-gbp/callback`.
4. Visit `/api/auth/google-gbp` while logged in as GBP owner. The callback page prints `GOOGLE_GBP_REFRESH_TOKEN`, `GOOGLE_GBP_ACCOUNT_ID`, and `GOOGLE_GBP_LOCATION_ID` — pick the Garage Guys Newport Beach location (3848 Campus Dr).
5. Paste those three into Vercel Production env, redeploy, then run `/api/google-reviews-sync`. The same call pushes hours **7:00–20:00, 7 days** and the service list from `scripts/seo-business.mjs`. Profile errors do not fail the review import.

## Notes

- Service account used for GSC/GA4 does **not** replace GBP OAuth for reviews or profile writes.
- Also enable **My Business Business Information API** for hours/services PATCH.
- Marketing site falls back to hardcoded 74 / 7 if Supabase is empty.
- New Google reviews create `inbox_items` with `item_type = review` for the office inbox.
