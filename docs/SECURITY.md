# Security and privacy design

This app handles mutual fund statements (CAS), which contain personal and financial data. The design
goal is to not hold that data anywhere it can leak.

## What stays where

| Data | Where it goes |
|---|---|
| Your CAS PDF and its password | Nowhere. Read in your browser only (from milestone 2). Never uploaded, never stored on a server. |
| Parsed transactions | Browser memory only in v1. Nothing is persisted between visits. |
| NAV lookups | Your browser calls this site's own `/api/*`, which forwards to mfnav.in. Only public scheme codes, ISINs and dates are sent. |

## The proxy (`proxy/core.ts`)

mfnav.in sends no CORS headers, so a small same-origin proxy is required. It is deliberately narrow:

- `GET` only; paths limited to `/api/funds`, `/api/nav`, `/api/date` with at most three safe segments.
- Query parameters limited to a fixed allow-list of keys, with short, character-restricted values.
- The upstream host is a constant. No client-supplied URL, header, cookie or body is forwarded.
- Redirects are not followed; responses must be JSON, at most 5 MB; 10 second timeout.
- No storage and no logging of request contents.

## Access control

The site itself contains no personal data (statements never reach it), but an open proxy can be abused
and will consume your share of mfnav.in's rate limit (120 requests/min per IP). If you deploy publicly:

- **Cloudflare Pages:** put the site behind Cloudflare Access (free for up to 50 users).
- **Vercel:** set `SITE_USER` and `SITE_PASS` to enable the Basic Auth gate in `middleware.ts`. It covers the page and
  `/api`; the hashed JS/CSS bundle is public code from a public repo and is deliberately not gated.
- **Local:** binds to 127.0.0.1 only; no gate needed.

## Hardening in the repo

- Strict CSP (`script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`), no third-party scripts or CDNs.
  The same headers ship for both hosts and a test fails if they drift.
- `scripts/scan-pii.mjs` (pre-commit hook and CI) blocks PDFs, PAN-shaped numbers and real-looking email addresses.
  `*.pdf` is also in `.gitignore`.
- `npm audit` runs in CI. Keep dependencies few and pinned by the lockfile.

## Limits

This protects against repository, CDN, server and log leaks and network sniffing. It does not protect against
malware on your device or a malicious browser extension. Use your own computer, and clear data when done.

## Reporting a vulnerability

Please open a private security advisory on the repository rather than a public issue.
