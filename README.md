# Verax

**The true return on your funds.**

Verax is a mutual fund portfolio dashboard for India. It reads your CAS (Consolidated Account Statement) PDF **in
your browser** and values your holdings with live NAVs from [mfnav.in](https://mfnav.in). No database, no accounts,
and your statement is never uploaded. The name is Latin for "truthful".

> **Status: milestone 1.** The scaffold, the NAV proxy, and deployment on Cloudflare Pages, Vercel or your own
> machine are done. The page currently looks up a fund's NAV. Statement upload, holdings and XIRR come next.
> See [PRD](docs/PRD.md) for the full plan and the decisions behind it.

## Run it locally

Requires Node 24 (LTS), the version both hosts and CI use.

```bash
npm ci
npm run build
npm start          # http://127.0.0.1:8787
```

For development with hot reload: `npm run dev`. Both use the same proxy code as the hosted versions.

## Deploy

Both hosts build with `npm test && npm run build` and serve `dist/`, so a failing test blocks the deploy. That is a free
second safety net besides GitHub Actions. No environment variables are required.

### Cloudflare Pages

1. Create a Pages project from this repository (Workers & Pages, Create, Pages, Connect to Git).
2. Build command `npm test && npm run build`, output directory `dist`. The Node version comes from `.node-version`, so there is no dashboard setting to change.
3. The proxy is `functions/api/[[path]].ts`; security headers and the year-long cache for hashed assets come from
   `public/_headers`, and `public/_routes.json` limits Functions to `/api/*` so page loads never count against the free
   100,000 requests a day.
   Cloudflare does not cache Function responses on its own, so the wrapper stores them in the Cache API (per data
   center). Cloudflare documents that API as unavailable behind Cloudflare Access for Workers, and does not say either
   way for Pages, so after enabling Access, check the second request to `/api/funds/119551` is fast (a few ms).
4. **Protect it.** Add a Cloudflare Access application for the site's hostname and allow only your email addresses
   (free for up to 50 users).

### Vercel

1. Import the repository. Vercel detects Vite; the defaults work.
2. The proxy is `api/[...path].ts`; security headers, the build command and the function region (`bom1`, Mumbai,
   for Indian users; change `regions` in `vercel.json` to suit yours) come from `vercel.json`.
3. **Protect it.** Vercel's built-in password protection is a paid feature. Instead, set `SITE_USER` and
   `SITE_PASS` in the project's environment variables. `middleware.ts` then requires Basic Auth for the page and `/api`. The hashed JS/CSS
   under `/assets` is public code and is not gated. Without the variables the gate is off.

### After deploying

```bash
scripts/smoke.sh https://your-site.example       # add SMOKE_AUTH='user:pass' if the site is gated
```

## Privacy in one paragraph

Your statement and its password are handled only in your browser and are never sent anywhere. The server side is a
tiny proxy that forwards public NAV requests to mfnav.in. Details, limits and the threat model are in
[docs/SECURITY.md](docs/SECURITY.md). Do not commit statements: `*.pdf` is ignored, and a pre-commit hook plus CI reject PDFs,
PAN numbers and real email addresses.

## Project layout

| Path | Purpose |
|---|---|
| `src/` | Preact app (Vite) |
| `proxy/core.ts` | The one proxy implementation, with tests |
| `functions/api/[[path]].ts` | Cloudflare Pages wrapper |
| `api/[...path].ts`, `middleware.ts` | Vercel wrapper and optional Basic Auth gate |
| `server/local.ts` | Local Node server (static files + proxy, localhost only) |
| `scripts/` | Repo scan, hook setup, deployment smoke test |

## Development

```bash
npm test          # unit tests (proxy, headers parity across hosts, repo scan)
npm run typecheck
npm run scan      # PDF / PAN / email check over the working tree
```

## Disclaimer

NAVs come from mfnav.in (sourced from AMFI). Figures are informational only and are not investment advice. Verify
with your AMC or your CAS before acting.

## Licence

MIT, see [LICENSE](LICENSE).
