# Doctor Dekho Web

The patient-facing doctor-booking portal — **Doctor Dekho** — as a standalone Next.js app.

It was split out of the `NexEagleWebsite` repo (which now holds only the corporate / B2B site at
`nexeagle.com`). Full git history up to the split is preserved here.

| | Dev | Prod |
|---|---|---|
| Public URL | https://doctordekho-dev.nexeagle.com | https://doctordekho.nexeagle.com |
| Branch | `dev` | `main` |
| VM / host port | Dev VM `151.185.45.77` : `84` | Prod VM `151.185.45.67` : `8081` |
| Container | `doctordekho-web-dev` | `doctordekho-web` |

The corporate site is a **separate** app/container (`nexeagle-dev.nexeagle.com` → `:82`,
`nexeagle.com` → `:8080`). This app links out to it (For Hospitals, Privacy, Terms) via
`BUSINESS_URL` in [`src/lib/site.ts`](src/lib/site.ts).

## What's in here

Backed live by EasyHMS's public API: `/` (search), `/doctors/[doctorSlug]`,
`/specialties/[specialty]` (+ `/[city]`, `/[city]/[area]`), `/conditions/[condition]`
(+ city/area), `/hospitals`, `/labs`, `/health/conditions/[condition]`, `/appointments`,
`/profile` (+ health locker, personal info), `/login` (WhatsApp OTP), `/offline`.

`app/api/**` are same-origin server-side proxies to the EasyHMS API — the browser never calls the
API directly, so **no backend CORS entry is needed for this app's origin**.

## Tech stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind + shadcn/ui · react-query (+ persisted
cache) · Serwist PWA (`app/sw.ts`, `app/manifest.ts`) · Mapbox (maps/directions) · i18n
(English / Hindi / Bengali / Hinglish).

## Environment variables

See `.env.example` for the annotated list.

| Variable | Required | Purpose |
|---|---|---|
| `EASYHMS_API_BASE_URL` | Yes | Root of the EasyHMS public API (no trailing slash, no `/api`). Also read at **build** time by the statically generated specialty pages. |
| `NEXT_PUBLIC_SITE_URL` | Build-time | This deployment's own public origin. Drives canonical URLs, sitemap, share links, JSON-LD, and whether robots allow indexing. Defaults to the prod origin. |
| `NEXT_PUBLIC_BUSINESS_URL` | Build-time | The corporate site's origin, for outbound links. Defaults to `https://nexeagle.com`. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Mapbox public token (build-time). Restrict it to the doctordekho domains in the Mapbox dashboard. |
| `EASYHMS_API_KEY` / `_HEADER` | No | Optional API-key identification. Server-side only. |
| `EASYHMS_TRUSTED_PROXY_SECRET` | No | Lets the API's rate limiters see each visitor's real IP. Must match `Internal:ProxyForwardingSecret` in easyHMSAPI. |
| `ANTHROPIC_API_KEY` | No | AI search fallback for free-text symptom queries. |

`NEXT_PUBLIC_*` values are inlined at **build** time. `next build` always loads `.env.production`,
so the dev image would silently bake in *prod* origins/data unless the deploy passes the dev values
as Docker build-args — `deploy.yml` does; don't remove them.

Non-production origins (`SITE_URL` ≠ the prod origin) serve `robots: Disallow /` and
`noindex`, so the dev host can never compete with the real site in search.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start
```

## Deployment

`.github/workflows/deploy.yml` — on push, builds the Docker image → GHCR → SSH-deploys.
The deploy only ever replaces **its own** container; if another container holds the target host
port it fails rather than removing it (both VMs are shared with other services).

**One-off per environment:** run the `Setup — domain` workflow (`setup-domain.yml`, manual) to add
the Caddy site block that terminates HTTPS for the hostname and proxies to the port above. Until
that runs, the domain has DNS but no TLS.

Required GitHub Actions secrets are listed at the top of `deploy.yml` (same names as the
NexEagleWebsite repo — same VMs, same backend).

## Cut-over notes (moving off nexeagle.com)

Doctor Dekho used to be served from `nexeagle.com/`. Old URLs keep working through permanent
redirects in the corporate site (`nexeagle.com/doctors/*`, `/specialties/*`, … → here); **keep
those redirects indefinitely** — printed hospital QR posters and shared WhatsApp links point at the
old paths. Order matters: this app must be live on the new domain *before* the corporate site
starts redirecting to it.

Per-origin state does not migrate: the patient login cookie, guest-appointment history
(localStorage) and installed PWAs are tied to the old origin, so returning users sign in again.
