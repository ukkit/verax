# Verax

**The true return on your funds.**

Verax is a mutual fund portfolio dashboard for India. It reads your CAS (Consolidated Account Statement) PDF in your
browser and values your holdings with live NAVs from [mfnav.in](https://mfnav.in). It has no database or accounts, and
your statement is never uploaded. The name is Latin for "truthful".

## What it does

- Opens a CAMS or KFintech "Detailed" statement in your browser and checks every scheme against its own running balances.
  A scheme that does not add up is left out of every total, with the reason shown. KFintech statements are in beta.
- Values your holdings with live NAVs from mfnav.in, matched by ISIN. A fund that cannot be matched is valued at the
  statement's own NAV, and the page says so.
- Shows value, invested amount (FIFO), gain, day change and XIRR per fund and for the whole portfolio, with closed
  positions included in the return and kept in their own section.
- Keeps several profiles separate, draws a NAV chart per fund with your purchases and sales marked, charts what you invested
  against what it was worth over the years (on request, from the NAV history or the statement's own NAVs), and lists every transaction with filters.
- Optionally remembers your statements on the device, encrypted with a passphrase, and locks itself when idle.

See the [PRD](docs/PRD.md) for the plan and decisions.

## Deploy to Vercel

This is the route that has been tried on this project. It needs Node 24 on your computer and a free Vercel account. An email
address is enough for the account, and cloning the public repository needs no login.

```bash
git clone https://github.com/ukkit/verax
cd verax
npx vercel login          # sends a sign-in link to your email
npx vercel --prod         # answer the prompts
```

On the first run the CLI asks whether to set up and deploy, which scope to use, whether to link an existing project (no),
what to call the project (`verax`, or another name if that is taken) and where the code is (press Enter for `./`). Accept
the detected Vite settings, because `vercel.json` sets the build command and the function region. If the CLI offers to
connect the project to the GitHub repository, you can decline: connecting needs a GitHub login connection in your Vercel
account, and a Hobby team allows only one.

Vercel builds the project in its cloud with `npm test && npm run build`, so a failing test blocks the deploy, and prints the
address. To update, get the new code and deploy again:

```bash
git pull
npx vercel --prod
```

The project is not connected to Git, so pushing to GitHub does not redeploy it.

Check the deployment from the repository folder:

```bash
scripts/smoke.sh https://your-site.vercel.app       # add SMOKE_AUTH='user:pass' if the site is gated
```

Notes for Vercel:

- The proxy is `api/proxy.ts`, reached through a rewrite in `vercel.json` (Vercel routes a catch-all file only one path
  segment). Security headers, the build command and the function region (`bom1`, Mumbai; change `regions` in `vercel.json`
  to suit you) also come from `vercel.json`.
- Protect the site if it is public. Vercel's built-in password protection is a paid feature. Instead, set `SITE_USER` and
  `SITE_PASS` in the project's environment variables and redeploy. `middleware.ts` then requires Basic Auth for the page
  and `/api`. The hashed JS and CSS under `/assets` is public code and is not gated. Without the variables the gate is off.
- Every hosted copy shares mfnav.in's limit of 120 requests a minute per IP. The app keeps to 60 a minute from each
  browser.
- Known issue: on Vercel, mfnav.in has answered requests from Vercel's servers with HTTP 403, so live NAVs and NAV history
  may not load. The page then values funds at the NAVs printed on your statement and says so. Running the app on your own
  computer does not have this problem.

## Run it locally

Requires Node 24 (LTS), the version the hosts and CI use. No account is needed.

```bash
git clone https://github.com/ukkit/verax        # or download the ZIP from the repository page
cd verax
npm ci
npm run build
npm start          # http://127.0.0.1:8787
```

For development with hot reload: `npm run dev`. Both use the same proxy code as the hosted versions.

## Other ways to deploy (untested)

These follow each host's documentation but have not been tried on this project yet.

### Cloudflare Pages, from the command line

It needs a Cloudflare account and Node 24. Run it from the repository folder so the Functions folder is picked up:

```bash
npm ci
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name verax
```

Add another `--project-name` if `verax` is taken. To update, rebuild and run the last command again.

### Cloudflare Pages, from GitHub

1. Fork this repository, then create a Pages project from your fork (Workers & Pages, Create, Pages, Connect to Git).
2. Build command `npm test && npm run build`, output directory `dist`. The Node version comes from `.node-version`, so there is no dashboard setting to change.
3. The proxy is `functions/api/[[path]].ts`. Security headers and the year-long cache for hashed assets come from
   `public/_headers`, and `public/_routes.json` limits Functions to `/api/*` so page loads never count against the free
   100,000 requests a day. Cloudflare does not cache Function responses on its own, so the wrapper stores them in the Cache
   API (per data center). Cloudflare documents that API as unavailable behind Cloudflare Access for Workers, and does not
   say either way for Pages, so after enabling Access, check that the second request to `/api/funds/119551` is fast (a few ms).
4. Protect the site. Add a Cloudflare Access application for the site's hostname and allow only your email addresses
   (free for up to 50 users).

### Vercel, from GitHub

Fork this repository, then in Vercel choose Add New, then Project, and import your fork. Every push to your fork redeploys.
Your Vercel login needs a GitHub connection for the account that owns the fork. Vercel also offers a Deploy button, which
copies the code into a new repository that is not a fork and so does not receive later changes from this one.

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
| `src/valuation/` | Live NAV lookups (ISIN to scheme code, cached, at most 4 at a time and 60 a minute) and portfolio valuation |
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
