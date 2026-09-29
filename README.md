# Verax

**The true return on your funds.**

Verax is a mutual fund portfolio dashboard for India. It reads your CAS (Consolidated Account Statement) PDF in your
browser and values your holdings with live NAVs from [mfnav.in](https://mfnav.in). It has no database or accounts, and
your statement is never uploaded. The name is Latin for "truthful".

## What it does

- Opens a CAMS or KFintech "Detailed" statement in your browser and checks every scheme against its own running balances.
  A scheme that does not add up is left out of every total, with the reason shown. KFintech statements are in beta.
- Values your holdings with live NAVs from mfnav.in, matched by ISIN. A fund that cannot be matched can be given a scheme
  code by hand, and is valued at the statement's own NAV until then.
- Shows value, invested amount (FIFO), gain, day change and XIRR per fund and for the whole portfolio, with closed
  positions included in the return and kept in their own section.
- Keeps several profiles separate, draws a NAV chart per fund with your purchases and sales marked, charts what you invested
  against what it was worth over the years (on request), and lists every transaction with filters.
- Optionally remembers your statements on the device, encrypted with a passphrase, and locks itself when idle.

See the [PRD](docs/PRD.md) for the plan and decisions.

## Run it locally

Requires Node 24 (LTS), the version both hosts and CI use.

```bash
npm ci
npm run build
npm start          # http://127.0.0.1:8787
```

For development with hot reload: `npm run dev`. Both use the same proxy code as the hosted versions.

## Deploy your own copy

Cloudflare Pages and Vercel deploy from a repository in your own GitHub account, so you need your own copy of this one.
Anyone can host it.

- Vercel: the button clones the repository into your account and starts the project setup.

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fukkit%2Fverax&project-name=verax&repository-name=verax)

  The password gate is optional, so the button does not ask for `SITE_USER` and `SITE_PASS`. Add them under the project's
  environment variables if you want the gate (see [Vercel](#vercel) below).
- Cloudflare Pages: fork this repository on GitHub first (the Fork button, or `gh repo fork ukkit/verax --clone=false`),
  then follow [Cloudflare Pages](#cloudflare-pages) below and pick your fork. Cloudflare's Pages documentation describes
  only its Git integration, so there is no deploy button here.
- Your own computer: clone the repository and follow "Run it locally" above. No hosting account is needed.

Every deployment shares mfnav.in's limit of 120 requests a minute per IP, so if you host it publicly, protect it with the
access step in the deploy section for your host.

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
4. Protect the site. Add a Cloudflare Access application for the site's hostname and allow only your email addresses
   (free for up to 50 users).

### Vercel

1. Import the repository. Vercel detects Vite; the defaults work.
2. The proxy is `api/proxy.ts`, reached through a rewrite in `vercel.json` (Vercel routes a catch-all file only one path
   segment); security headers, the build command and the function region (`bom1`, Mumbai,
   for Indian users; change `regions` in `vercel.json` to suit yours) come from `vercel.json`.
3. Protect the site. Vercel's built-in password protection is a paid feature. Instead, set `SITE_USER` and
   `SITE_PASS` in the project's environment variables. `middleware.ts` then requires Basic Auth for the page and `/api`. The hashed JS/CSS
   under `/assets` is public code and is not gated. Without the variables the gate is off.

### After deploying

```bash
scripts/smoke.sh https://your-site.example       # add SMOKE_AUTH='user:pass' if the site is gated
```

## Privacy in one paragraph

Your statement and its password are handled only in your browser and are never sent anywhere. By default nothing is
kept after you close the tab; if you choose "Remember on this device", the parsed statements are saved encrypted
(AES-256-GCM, key from your passphrase), and a forgotten passphrase cannot be recovered. The server side is a tiny proxy
that forwards public NAV requests to mfnav.in. Details, limits and the threat model are in
[docs/SECURITY.md](docs/SECURITY.md). Do not commit statements: `*.pdf` is ignored, and a pre-commit hook plus CI reject PDFs,
PAN numbers and real email addresses.

## Project layout

| Path | Purpose |
|---|---|
| `src/` | Preact app (Vite): `ui/` components, `parser/` the statement reader (runs in a Web Worker) |
| `src/domain/` | Holdings (FIFO), XIRR, value over time, chart geometry and transaction filters; pure and unit-tested |
| `src/valuation/` | Live NAV lookups (ISIN to scheme code, cached, at most 4 at a time) and portfolio valuation |
| `src/vault/` | The opt-in encrypted store: PBKDF2-SHA256 and AES-256-GCM through WebCrypto, kept in IndexedDB |
| `tools/parser-oracle/` | Dev-only check of the parser against casparser on your own statements ([guide](docs/parser-oracle.md)) |
| `tools/valuation-check/` | Dev-only check of holdings and valuation against your own statement's figures ([guide](docs/valuation-check.md)) |
| `proxy/core.ts` | The one proxy implementation, with tests |
| `functions/api/[[path]].ts` | Cloudflare Pages wrapper |
| `api/proxy.ts`, `middleware.ts` | Vercel wrapper (with the `vercel.json` rewrite) and optional Basic Auth gate |
| `server/local.ts` | Local Node server (static files + proxy, localhost only) |
| `scripts/` | Repo scan, hook setup, deployment smoke test |

## Development

```bash
npm test          # unit tests (parser, holdings, valuation, vault, proxy, headers parity across hosts)
npm run typecheck
npm run scan      # PDF / PAN / email check over the working tree
```

## Disclaimer

NAVs come from mfnav.in (sourced from AMFI). Figures are informational only and are not investment advice. Verify
with your AMC or your CAS before acting.

## Licence

MIT, see [LICENSE](LICENSE). The parser is a TypeScript port of parts of casparser (MIT) and the site bundles PDF.js
(Apache-2.0); see [NOTICE](NOTICE).
