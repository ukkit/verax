# PRD: Verax, a Mutual Fund Portfolio Dashboard

Name: **Verax** (Latin *verax*, "truthful"). Tagline: **"The true return on your funds."** Chosen 2026-09-29 after a naming exploration (English, Hindi/Sanskrit and invented Latin-root candidates); shortlisted alternatives were Cask, Tenax, Ganak and Freehold. Domain, GitHub and npm availability were deliberately not checked, so confirm them before publishing.

Status: Milestones 1 to 5 done (parser validated on synthetic statements, in a real browser, and on two real CAMS statements) · Decisions confirmed (grilling session, Q1–Q24) · Date: 2026-09-29

## Progress (2026-09-29)

| # | Milestone | Status | Evidence |
|---|---|---|---|
| 1 | Scaffold, shared proxy, three hosts, CI, PII guard | **Done** | Smoke tests on the local server and Cloudflare's runtime; not yet deployed on either host |
| 2 | Statement parser, worker, upload UI, reconciliation | **Done** | 194 tests; 22 browser checks; 1,636 of 1,636 real transactions matched casparser; privacy check clean |
| 3 | Holdings (FIFO), XIRR, live NAV valuation, closed positions, profiles | **Done** | 229 tests; browser run (profiles, override, replace, remove, no external requests, no console errors); real-statement check passed (§10) |
| 4 | Charts, transaction view, stale-NAV badge, polish | **Done** | 243 tests; 11 browser checks (chart with markers, ranges, allocation, filters, badge, no external requests, no console errors); hand-drawn SVG, no chart dependency |
| 5 | Encrypted "Remember on this device", auto-lock | **Done** | 252 tests; 23 browser checks (record holds only ciphertext, unlock, wrong passphrase, lock, idle auto-lock, persistence of add/remove/setting, forget) |

Open items: a real KFintech statement to lift the beta label, and the first real deploy on Cloudflare Pages and Vercel (§14).

## 1. Problem & Goal
Investors hold funds across AMCs; the CAS (Consolidated Account Statement) PDF has full transaction history but no live valuation or returns view. Build a dashboard that reads a CAS PDF in the browser, values holdings with current NAVs from mfnav.in, and shows portfolio value, gains, and XIRR. It deploys in minutes on free hosting (Cloudflare Pages or Vercel), or runs locally, with no database.

## 2. Users
- Individual investors self-hosting for themselves and family. Multiple profiles (e.g. Neeraj, Nidhi), each uploaded and kept separate. Profile names are labels the user types; they are not read from the PDF.
- Other people can clone the repo (public, MIT) and deploy or run it locally.

## 3. Research Findings (constraints)
- **mfnav.in API**: free, no key, 120 req/min/IP anonymous. Terms: free for any purpose incl. commercial, no attribution required, data "as is"; caching/proxying not addressed. API keys "coming soon". Endpoints: `GET /api/funds/search?q=<ISIN|code|name>`, `GET /api/funds/{scheme_code}` (latest_nav, latest_nav_date, isin, isin_reinvest, plan/option, category), `GET /api/nav/{scheme_code}?start_date&end_date` (history, newest first, paginated), `GET /api/date/latest`. Schema: `https://mfnav.in/openapi.json`.
- **No CORS headers** on mfnav.in (verified) → browser cannot call it; a same-origin proxy is required.
- CAS PDFs contain PII (name, PAN, email, folios) and are usually password-protected.
- **Vercel** Password Protection is not on the free Hobby plan ($20/project/month on Pro). **Cloudflare Access** is free for up to 50 users. Netlify's free plan is credit-capped and Basic Auth is Pro-only for new accounts; GitHub Pages has no proxy or auth.
- Example CAS files exist locally (`~/Downloads/*cas*.pdf`, `~/git/old.processCASpdf/test/`); they are never copied into this repo.

## 4. Scope
### In (v1)
1. Upload/unlock a **detailed** CAS in the browser; parse locally. **CAMS-generated statements are supported and validated** (they also contain KFintech-registrar funds). **KFintech-generated statements are marked beta/untested** until a real one has been run through the spike; unreadable or non-reconciling files are rejected or flagged, never shown with wrong numbers. NSDL/CDSL files get a clear "not supported yet" message. Non-mutual-fund holdings are out of scope.
2. Multiple profiles, each separate. Newest CAS per profile is the source of truth; merge (dedupe by folio+date+units+amount) only when a CAS covers a limited date range.
3. Map each scheme to an mfnav `scheme_code` via ISIN (mfnav only); unmapped funds show a manual scheme-code field and are valued at the CAS NAV meanwhile.
4. Holdings table: units, avg cost (derived from FIFO lots), invested, current value, unrealised gain (abs, %), day change, NAV date.
5. Portfolio summary: invested, current value, total gain, absolute return, portfolio XIRR (headline), per-fund XIRR.
6. Closed (fully redeemed) positions: always included in XIRR; hidden by default in a collapsed "Closed positions" section showing realised gain (proceeds minus FIFO cost, not a tax report).
7. Charts: per-fund NAV history (1Y, 3Y, since first purchase) with buy/sell markers; allocation by category and AMC.
8. Transaction list with filters (fund, type, date).
9. Failure handling: continue and flag. A banner shows how many schemes failed reconciliation (the level at which a statement prints a closing balance); each is marked and **excluded from totals**, and the banner lists which. No debug export.
10. Clear-data button. Permanent disclaimer footer (§6).

### Out (v1) / later
- After milestone 3: encrypted "Remember on this device" (§9).
- v2: portfolio-value-over-time chart, LTCG/STCG tax reports, combined household view, NSDL/CDSL support, Docker image.
- Not planned: accounts/login, multi-device sync, broker/AMC integrations, PWA offline mode, second NAV source, mfnav API keys (until offered).

## 5. Calculation rules
- **Cost basis**: FIFO lots (future-proofs v2 tax); UI shows average cost derived from lots.
- **Switches**: switch-out = sell, switch-in = buy; they net to about zero in portfolio XIRR.
- **Dividends**: IDCW payouts are cash inflows on their date; reinvested IDCW are buys with no new cash out.
- **Stamp duty / STT / TDS**: stamp duty is added to the cost of the purchase it belongs to.
- **XIRR**: Newton with bisection fallback; current value as terminal inflow; closed folios included.
- **Acceptance**: per-scheme computed closing units equal the CAS closing balance exactly; total value within 0.1% of the CAS valuation (allowing for NAV date differences).

## 6. Non-Functional Requirements
- **Privacy/Security**: see §9.
- **Performance**: first load < 200 KB gzip excluding pdf.js worker (lazy-loaded); 30-fund portfolio valued < 3 s warm; proxy responses `s-maxage=3600, stale-while-revalidate=86400`.
- **Deployability**: `git push` → Cloudflare Pages or Vercel via each host's Git integration; no database; no required env vars (only Vercel's optional gate uses two).
- **UX**: INR with Indian grouping (₹12,34,567.89); light/dark follows system; mobile-first (tables collapse to cards).
- **Disclaimer** (permanent footer on every screen): "NAVs from mfnav.in (sourced from AMFI). Figures are informational only and not investment advice. Verify with your AMC or CAS before acting." Every valuation shows its NAV date.
- **Compatibility**: latest Chrome/Firefox/Safari.

## 7. Architecture
```
Browser (static SPA)                    Cloudflare Pages | Vercel | local Node
 ├─ pick cas.pdf + password (local)      ├─ static assets
 ├─ pdf.js in Web Worker → parser        └─ /api/nav/*  thin wrapper
 ├─ session memory (v1)                          │ calls shared proxy core
 ├─ holdings / XIRR computed locally             ▼
 └─ fetch same-origin /api/nav/* ─────────► https://mfnav.in/api/...
```
Stack: Vite + TypeScript + Preact, `pdfjs-dist`, uPlot (NAV chart) + plain SVG (allocation), Vitest.

### Proxy: one core, three wrappers
- `proxy/core.ts` — pure `handle(Request) → Response` on web-standard APIs: GET-only, path regex allow-list to `https://mfnav.in/api/(funds|nav|date)/…`, timeout, no cookie/header forwarding, cache headers.
- `functions/api/[[path]].ts` (Cloudflare Pages Function), `api/[...path].ts` (Vercel), `server/local.ts` (Node). Each ~10 lines.
- Unit tests cover the core (allowed/rejected paths, headers, timeouts). CI runs core tests only and does not deploy. `scripts/smoke.sh <base-url>` curls a NAV endpoint and a blocked path on any deployed URL; run by hand after first deploy on each host.

### Hosting options
| Target | How | Access gate (optional, documented) |
|---|---|---|
| Cloudflare Pages | Git integration; Pages Function wrapper (Cache API for edge caching) | Cloudflare Access (free ≤ 50 users), dashboard config, no code |
| Vercel | Git integration; function wrapper | `middleware.ts` Basic Auth, inactive unless `SITE_USER` and `SITE_PASS` are set |
| Local | Node 24 (LTS): `npm ci && npm run build && npm start` → `http://127.0.0.1:8787` (localhost only) | None |

The README states plainly that anyone deploying publicly must opt in to protecting the proxy.

### Host best practices applied (checked against Cloudflare's and Vercel's docs, 2026-09-29)
- **Cloudflare: stay on Pages.** Cloudflare now recommends Workers with static assets for *new* projects and says Pages stays supported. Pages was kept because the Cache API is functional for Pages Functions on the free `*.pages.dev` address, while on Workers it works only on a custom domain. Revisit if Cloudflare starts retiring Pages, or when a custom domain is in use.
- **Cloudflare `_routes.json`** (`public/_routes.json`, `include: ["/api/*"]`): without it every request, including page loads, invokes the Function and counts against the free 100,000 requests a day. Static assets are free and unlimited.
- **Cloudflare edge caching:** Cloudflare's CDN does not cache Function/JSON responses on its own, so `functions/api/[[path]].ts` stores shareable responses in the per-data-center Cache API (`proxy/edge-cache.ts`). Measured on Wrangler: 96 ms uncached, about 3 ms cached. Cloudflare documents the Cache API as unavailable for Workers behind Cloudflare Access and is silent for Pages: check after enabling Access. `_headers` does not apply to Function responses, which is fine for JSON (the core sets `nosniff`).
- **Vercel:** `api/[...path].ts` uses the `export default { fetch }` web handler from the docs; the CDN honours `s-maxage` and `stale-while-revalidate` on function responses. Function region is `bom1` (Mumbai; Vercel defaults to Washington, D.C.), which matters on cache misses for Indian users; the Hobby plan allows one region. `vercel.json` stays (`vercel.ts` needs an extra package and Vercel says to use only one of the two). SPA deep links would need a `rewrites` entry, added when client-side routes exist.
- **Both:** hashed files under `/assets` get `Cache-Control: public, max-age=31536000, immutable` (Vercel's default is to revalidate every time). Node is pinned to `24.x` (`engines`, `.node-version`, CI) because Vercel warns that a range auto-upgrades when a new major ships; Cloudflare reads `.node-version`.
- **Vercel gate scope:** `middleware.ts` matches only `/` and `/api/:path*` (a middleware call is billed per match); the public JS/CSS bundle is left ungated.

### Repo & CI
- Public GitHub repo, **MIT** (changed from BSD-3-Clause after research showed no camspdf-derived code is used). The MIT notice of casparser is kept for anything ported from it (`NOTICE` file). `SECURITY.md` documents the privacy design.
- GitHub Actions (free and unlimited on a public repo): `ci.yml` runs typecheck, tests, build and `npm audit`; it skips docs-only changes, cancels superseded PR runs, and has a 10-minute cap. `scan.yml` runs the personal-data scan (PDFs, PAN pattern `[A-Z]{5}[0-9]{4}[A-Z]`, emails) on every push and PR including docs-only ones; it needs no install and takes seconds. Local pre-commit hook blocks the same.
- Both hosts build with `npm test && npm run build` (set in `vercel.json` and the Cloudflare dashboard), so a failing test blocks a deploy even without Actions.
- If `ci.yml` is ever made a required status check, note that GitHub leaves a skipped (path-filtered) required check pending on docs-only PRs; make only `scan` required, or drop the path filter.

### Modules
`src/parser/*`, `src/domain/holdings.ts`, `src/domain/xirr.ts`, `src/api/nav.ts`, `src/ui/*`, `proxy/core.ts` + wrappers, `vercel.json` / `_headers` (security headers, CSP).

## 8. Parser (decided: Option C, in-browser PDF upload from v1)
Decided: port to TypeScript, run in-browser, keep transaction descriptions, capture closing balance and valuation, drop the hard-coded AMC list, synthetic fixtures only. **Base the port on `codereverser/casparser` (MIT, active: v1.4.1 Aug 2026, last push 2026-09-23, 231★) rather than the old `processCASpdf.py`.** Using casparser as-is was rejected: it needs Python + `pypdfium2` (no WebAssembly wheel on PyPI), so it would mean server-side parsing (breaks the privacy model) or a CLI step for every user (unusable for non-technical family). Comparison:

| | old `processCASpdf.py` | `casparser` (Python, MIT) |
|---|---|---|
| Extraction | pdfplumber lines + regex | per-glyph positions; detects table columns; assigns cells per row |
| Transaction types | Buy/Sell only | 15+: purchase, SIP, switch in/out, STP (incl. KFintech "S T P"), merger switches, dividend payout vs reinvest (with rate), STT/stamp duty/TDS, segregation, gift, reversal, misc |
| KFintech quirks | none | dedupes overlay "date-twin" text (avoids `2020` → `22002200`) |
| Reconciliation | none | validates running unit balances, sign-fix, `parse_warnings` per scheme |
| Closing balance / valuation / cost | not captured | Opening/Closing Unit Balance, "NAV on", "Valuation on", Total Cost Value |
| Multi-line names/descriptions | ad hoc | wrapped rows merged and re-classified |
| Statement types | CAMS/KFin detailed | + summary, NSDL, CDSL |

Other candidates reviewed:
- `cas-pdf-parser-react` (npm, TS, pdf.js, browser+Node, MIT): fits the stack, but v0.1.3, 0 stars, single author, no adoption. Use as a reference only; do not depend on it for a privacy-sensitive app. Provenance and correctness unverified.
- `cas2json` (Python): **AGPL-3.0** → licence-incompatible with MIT if copied (would force AGPL on this project). Do not port.
- `casparser-web`: appears server-side (FastAPI + Nuxt) → conflicts with the in-browser privacy model.
- Commercial APIs (CASParser.in etc.): upload PDFs to a third party → rejected.
- `amit26patil/Cas-Parser` and other forks: 2 commits / stale; not a basis.

Approach: TypeScript port of `casparser`'s CAMS/KFin **detailed** parser and `_classify` logic (MIT notice retained), on pdf.js text items (one item ≈ casparser's "atom", with x/y/width).

### Spike result (2026-09-29, run locally on real statements; nothing committed)
A ~250-line prototype (pdf.js text items → dedupe overlay twins → lines → columns → rows) was compared with casparser 1.4.1 as oracle on four real CAMS detailed statements (two profiles, different dates, up to 29 pages / 37 schemes):
- **2,422 of 2,422 transactions matched** exactly (date, units, amount, balance); 0 missing, 0 extra.
- **Closing unit balance matched for every scheme** (82 of 82); ISINs matched wherever both sides had one.
- Transaction mix included purchases, SIPs, redemptions, switches, IDCW payout and reinvest, segregation, STT/stamp duty/TDS and MISC rows.
- Extraction time 0.3–0.6 s per statement in Node.

Lessons that shape the implementation:
- **Do not rely on the table header row.** pdf.js splits header text into items unpredictably (0 of 36 headers detected). Infer the four number columns (amount, units, price, unit balance) from clusters of right-edge x positions of numeric cells on dated rows; assign cells by nearest anchor within ~14 pt. Lone amounts (stamp duty rows) then land in the amount column.
- **Start a scheme at each "Opening Unit Balance" line**, taking the ISIN from the preceding lines; some schemes have no ISIN in the statement, so match by folio + position within the folio, not by ISIN alone.
- **Skip the repeated page header "<date> To <date>"**; it starts with a date but is not a transaction.
- Overlay twin dedupe (KFintech "date-twin") is implemented but was not exercised: 0 duplicates found in CAMS files.

### Still to validate
- **KFintech-generated statements** (letter-spaced "S T P" rows, overlay duplicates, different header). The only sample on hand has a forgotten password, so v1 ships with KFintech marked **beta/untested** (§4); add a real KFintech fixture as soon as one is available (request a fresh detailed CAS from KFintech with a known password).
- Classification, opening/closing balance and valuation extraction, sign fixes and `parse_warnings` equivalents (the prototype only proves row and column reading).
- Summary (non-detailed) CAS and NSDL/CDSL are out of scope for v1.

### Implementation (milestone 2)
`src/parser/`: `layout` (items to lines, overlay dedupe) · `columns` (number columns from the data) · `classify`, `header`, `reconcile`, `detect`, `cams` (casparser ports) · `extract` (pdf.js adapter, error mapping) · `run`, `worker`, `client` (Web Worker, one worker per parse, terminated after) · `summary`. UI in `src/ui/`. All parser code is pure and unit-tested; `testing/` holds a synthetic-statement builder and a tiny PDF writer (test-only, never bundled).

Deliberate differences from casparser:
- **Privacy at parse time:** investor name, PAN, email, address, nominees and advisor are never read. Folio numbers are kept as their last four digits, including a counterparty folio inside a gift transfer's description (a test caught this leak). Any run of 8+ digits in a description (payment, UTR, cheque references) is masked to its last four; real statements contained dozens that the synthetic fixtures did not.
- **Hyphenated investor names** ("ANNE-MARIE SAMPLE") are recognised and skipped so they cannot be mistaken for a scheme line.
- **Reconciliation is per scheme**, and a scheme that fails is excluded from totals; unreadable scheme blocks surface as statement-level warnings instead of vanishing.
- Columns come from the data (right-edge clusters), not the header row, and accept a 3-column layout when the price column is missing.
- Numbers are plain JS numbers with a 0.005 tolerance (as casparser); the spike matched to the last digit.
- The source is `CAMS`, `KFINTECH`, or `UNKNOWN` (read as CAMS-style, labelled beta); NSDL, CDSL and Summary statements are refused with what to do.

Lessons from testing in a real browser (also in CLAUDE.md's failure log): pdf.js inside our own Worker cannot start its own worker and falls back to running its worker code in our thread, taking over `self.onmessage`; the parser worker therefore hands pdf.js an explicit `PDFWorker` port. Cleanup is on the loading task, not the document. First load is about 9 KB gzip; pdf.js (about 445 KB worker chunk plus 1.27 MB pdf.js worker) loads only when a file is chosen.

### Testing
The spike harness (oracle runner, prototype, redacted comparer) contains no data and becomes `tools/parser-oracle/` (dev-only; casparser is a test oracle, never a runtime dependency). Committed tests use synthetic text fixtures with invented names/folios/amounts covering multi-line names, split ISINs, stamp duty rows, dividends, STP, and a KFintech date-twin. Real-file comparison remains a manual local step; the report is counts and masked shapes only.

## 9. Data Protection & Encryption

Principle: the best protection is not holding the data. **v1 is session-only**: no server storage, nothing persisted in the browser; re-upload each visit (multiple profiles = multiple files in one session).

| Layer | Data | Protection |
|---|---|---|
| Source file | cas.pdf | Never committed (`*.pdf` in `.gitignore`, pre-commit hook + CI scan), never uploaded; read via `File` API in a Web Worker. Already encrypted by the registrar. |
| PDF password | Decrypt password | Memory only, passed to pdf.js, zeroed after parse. Never stored, logged or put in a URL. |
| Minimisation | Name, PAN, email, address, phone | Dropped at parse time. Keep `{amc, folio (masked to last 4), isin, scheme, txns}`. |
| In transit | NAV lookups | HTTPS + HSTS. Proxy requests contain only public scheme codes/ISINs. |
| At rest (v1) | Parsed transactions | Memory only; gone on reload or "Clear data". |
| At rest (later, opt-in "Remember", after milestone 3) | Parsed transactions | WebCrypto AES-256-GCM; key from user passphrase via PBKDF2-SHA256 (≥ 600k iterations) or Argon2id; random salt and IV per write; non-extractable `CryptoKey` in memory; only ciphertext in IndexedDB. Auto-lock on idle. Encrypted export only. |
| NAV cache | Public NAV data | IndexedDB, unencrypted, separate store, no PII. |
| Server/proxy | Stateless | No DB, no storage, logs path + status only. Optional access gate per §7. |
| App integrity | XSS / supply chain | CSP `default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`; no third-party scripts/CDNs; pdf.js worker bundled; lockfile, pinned versions, `npm audit` in CI; `Referrer-Policy: no-referrer`. |

Threat model: protects against repo/CDN leaks, server/log compromise, network sniffing, disk inspection (once encrypted persistence exists). Does not protect against XSS or malicious extensions on the same origin (mitigated by CSP and no third-party code), device malware, weak passphrases, or shared computers (use session-only). Forgotten passphrase = data unrecoverable; re-upload the CAS.

## 10. Milestones (each shippable)
1. **Done (2026-09-29, local verification).** Scaffold + shared proxy core + Cloudflare, Vercel and local wrappers; "look up a NAV" page; `smoke.sh`; CI with typecheck, tests, audit, PII scan; pre-commit PII hook. Verified: 48 unit tests; smoke test passes against the local server and Cloudflare's local runtime (Wrangler) with live mfnav.in; headless Chromium run shows no CSP violations and zero external requests. **Not yet verified:** a real deploy on Cloudflare Pages and Vercel (the Vercel wrapper and gate are unit-tested only, since `vercel dev` needs a login); run `scripts/smoke.sh <url>` after the first deploy on each.
2. **Done (2026-09-29, synthetic + browser verification).** Parser in `src/parser/` (TypeScript port of casparser), Web Worker, upload/unlock UI with per-scheme summary, reconciliation flags and the KFintech beta notice. Verified: 194 tests in total, including the real pdf.js on a generated PDF; a headless Chromium run (22 checks) on both the local server and Cloudflare's runtime: upload, banners, encrypted PDF (missing, wrong, right password), NSDL refusal, no request leaving the origin, no console errors. **Real-statement check passed (2026-09-29):** on two real CAMS statements (37 and 30 schemes) the parser matched casparser on 1,636 of 1,636 transactions with 0 missing and 0 extra, all transaction types, closing balances, valuation lines, ISINs, scheme names and folio last-four agreed, the reconcile flags agreed, and the source was detected as CAMS. The privacy check first found 53 and 19 runs of 8+ digits (payment references in descriptions); after masking them it is clean.
3. **Done (2026-09-29).** Holdings (FIFO lots, average cost derived), XIRR (Newton with bisection fallback; closed folios included), live NAV valuation via mfnav.in by ISIN (cached, stale-NAV badge, manual scheme-code override for unmapped funds), closed positions in a collapsed section with realised gain, and several profiles kept separate. Builds on `Statement` from milestone 2; only reconciled schemes enter totals. Acceptance: total value within 0.1% of the statement's own valuation, allowing for NAV date differences, checked on the real statements with a tool like `tools/parser-oracle`.
   **Real-statement check passed (2026-09-29, `tools/valuation-check`):** on a real CAMS statement with 13 open and 24 closed schemes, none excluded, FIFO cost and value at the statement's own NAVs both matched the statement (-0.000%), all 13 NAVs came from mfnav.in by ISIN, and the portfolio XIRR was 12.90%. Value at that day's live NAVs differed by -1.346%, which is NAV movement since the statement date. **Not yet measured:** the 3 s warm budget for 30 funds. The 13 funds took 5.1 s cold, directly against mfnav.in from Node, at two lookups per fund and 4 in flight; a warm run through the proxy's edge cache needs a deployed host.
4. **Done (2026-09-29).** Per-fund NAV chart (1 year, 3 years, since first purchase) with purchase and sale markers, opened from a holding's row; allocation by category (from mfnav.in) and by fund house; a collapsed Transactions section with scheme, type and date filters, shown 50 rows at a time; an "Older NAV" badge on any NAV older than the newest live NAV in the portfolio, and on statement-NAV fallbacks. Charts are hand-drawn SVG and the allocation is CSS bars, so uPlot (Q11) was not added: it fails the dependency rules (one maintainer, last release March 2025). NAV history is fetched only when a chart is opened, 1,000 rows a page, and cached per scheme and start date. First load is about 15.5 KB gzip.
5. **Done (2026-09-29).** Opt-in encrypted vault (`src/vault/`): PBKDF2-SHA256 at 600,000 iterations to an AES-256-GCM key, one record in IndexedDB holding all profiles, passphrase of 12+ characters typed twice, lock now, and an idle auto-lock the user picks (1, 5, 15 or 60 minutes, saved inside the vault). No dependency. Deviation from §9: salt per vault and IV per write, because a new salt on every save would need the passphrase kept. Encrypted export and import are deferred. The NAV cache stays in memory (session), not IndexedDB.

## 11. Acceptance / Verification
- Vitest: parser fixtures, transaction classification, FIFO, XIRR vs known values, proxy core.
- `curl <base>/api/nav/119551` returns `latest_nav` on Cloudflare, Vercel and local; non-allow-listed paths return 400.
- Real CAS: per-scheme closing units exact; total value within 0.1% of CAS valuation.
- Network tab: no PDF content or folio/amount data transmitted; only `/api/nav/*`.
- Repo scan finds no PDF, PAN pattern or email; CSP report clean; Lighthouse ≥ 90 perf/best-practices.

## 12. Risks
- CAS layout variations → CAMS is validated on real statements (spike: 4 statements; finished parser: 2 statements, 1,636 of 1,636 transactions). KFintech-generated statements are untested (beta). The reconciliation check and the excluded-scheme banner catch what a new layout would silently break.
- Real statements hold text the synthetic fixtures do not: payment references in descriptions leaked through until the real-file check found them. Re-run `tools/parser-oracle` and read its privacy line whenever the parser keeps another piece of text.
- mfnav.in availability or shared-IP rate limits across many deployments → edge cache, IndexedDB NAV cache, backoff, low concurrency, stale-NAV badge; proxy is the single swap point for a later AMFI fallback.
- Fund merges/renames/ISIN changes → manual scheme-code override.
- Licence compliance for ported code → `NOTICE` file, no AGPL sources. **Do not copy from `processCASpdf.py`**: it derives from `camspdf.py`, which is GPL-3.0 (its own LICENSE file says MIT and its header says BSD, so it is inconsistent). The parser is based on casparser (MIT) and the spike prototype was written from that design. With no camspdf-derived code, the original reason for BSD-3-Clause (Q19) no longer applied, so the project licence was changed to **MIT** (decision after Q24, 2026-09-29), matching casparser.

## 13. Decision log (grilling Q1–Q24)
Profiles: multiple, separate (Q1) · latest CAS wins (Q2) · public URL with optional gate, no baked PDF (Q3) · session-only v1 (Q4) · real-file acceptance, XIRR headline (Q5) · gate mechanism per host (Q6, Q22) · TypeScript port, in-browser (Q7) · real PDFs local spike only, synthetic fixtures committed (Q8) · mfnav-only scheme lookup (Q9) · FIFO/switch/dividend/stamp rules (Q10) · Preact + uPlot + SVG (Q11) · CAMS/KFin detailed only (Q12) · closed positions in XIRR, collapsed (Q13) · per-fund NAV chart + allocation (Q14) · flag and exclude failed folios (Q15) · public repo, CI scans (Q16, Q19) · INR, system theme, mobile-first (Q17) · Cloudflare + Vercel + local (Q18) · Node local run (Q20) · shared proxy core, core tests only in CI (Q21) · no second NAV source (Q23) · footer disclaimer (Q24).

## 14. Open questions
1. Obtain a real KFintech-generated detailed CAS with a known password and run it through the same tool (removes the "beta" label).
2. First deploy on Cloudflare Pages and Vercel, then `scripts/smoke.sh <url>` on each.

Resolved since the grilling session: parser is a TypeScript port of casparser (Option C); PDF upload from v1; KFintech-generated statements ship as beta (Option B).
