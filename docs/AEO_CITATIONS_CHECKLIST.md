# Citation listings — paste this NAP everywhere

Use this block as-is on Bing Places, Apple Business Connect, Yelp for Business, Angi, BBB, and Nextdoor. It matches the site JSON-LD (`scripts/seo-business.mjs` + homepage). Do not “improve” the wording per directory — mismatched NAP is how AI answer engines drop a business.

## Copy-paste

```
Business name: Garage Guys
Category: Garage Door Repair (Home Repair Service)
Phone: (949) 539-0009
Website: https://garageguysoc.com/
Address: Newport Beach, CA 92660
Service area: Orange County, California (Irvine, Tustin, Orange, Santa Ana, Anaheim, Costa Mesa, Newport Beach, Huntington Beach, and surrounding cities)
Hours: 7:00 AM–8:00 PM, 7 days a week
One-line description: Same-day garage door repair, spring repair, opener repair, and installation in Orange County, CA. Insured handyman service — not a licensed contractor; all work under $1,000/project per California AB 2622.
```

## Directory checklist (manual — Sam)

Each of these needs an account + verification (postcard, phone, or email). Create/claim, paste the block above, then tick:

- [ ] Bing Places
- [ ] Apple Business Connect
- [ ] Yelp for Business
- [ ] Angi
- [ ] BBB
- [ ] Nextdoor

## Google Business Profile (already on Maps)

OAuth for reviews/posts is coded. Sam must click Allow:

1. Open https://garageguysoc.com/api/auth/google-gbp while signed into the Garage Guys Google account that owns the Business Profile.
2. Click Allow.
3. Copy `GOOGLE_GBP_REFRESH_TOKEN` from the callback page into Vercel env (plus `GOOGLE_GBP_ACCOUNT_ID` / `GOOGLE_GBP_LOCATION_ID` if not set).
4. Redeploy, then hit `/api/google-reviews-sync`.

## Do not change

- Phone digits: always `(949) 539-0009` / `+19495390009`
- City line: `Newport Beach, CA 92660` (no street number on the public site)
- Name: `Garage Guys` (not “Garage Guys OC” on listings unless the profile already uses that and you are matching Google — prefer **Garage Guys**)
