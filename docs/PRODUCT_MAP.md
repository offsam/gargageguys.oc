# Garage Guys BOS — module map (from Consult → OC)

Independent system in this repo. Consult is a source of modules only — no runtime dependency.

| Module | Role after `/login` | Source in Consult | Target in OC |
|---|---|---|---|
| **Owner** | owner | Business Home / Owner GM | `/owner` |
| **CRM** | office | Entity workspace leads/customers/inbox | `/crm` |
| **SERM** | office | SEO panel + seo-metrics ingest + site seo-sync | `/serm` |
| **Alex** | public site | `lib/garage-guys/website-ai-employee` | `/api/chat` + existing widget |
| **Dispatcher** | dispatcher | Dispatch desk + dispatch-manager | `/dispatch` |
| **Accountant** | accountant | Billing + Accounting | `/finance` |
| **Field** | technician | `/field` PWA | `/field` |

## Webhooks (all local)

| Endpoint | Was | Now |
|---|---|---|
| `POST /api/callback` | Telegram + Twilio + Consult leads | Telegram + Twilio + local leads DB |
| `POST /api/chat` | Proxy → Consult | Local Alex agent |
| `GET/POST /api/seo-sync` | GSC/GA4 → Consult | GSC/GA4 → local `seo_snapshots` |

## Not ported

Canvas, org chambers UI, marketplace, multi-tenant AI Council.
