# Security and privacy design

This app handles mutual fund statements (CAS), which contain personal and financial data. The design
goal is to not hold that data anywhere it can leak.

## What stays where

| Data | Where it goes |
|---|---|
| Your CAS PDF and its password | Nowhere. Read in a Web Worker in your browser. Never uploaded, never stored. The password is used once to open the file; the worker is terminated after every parse, so neither the password nor the extracted text outlives it. |
| Parsed transactions | Browser memory by default; nothing is persisted between visits. Only if you choose "Remember on this device" are they also saved, encrypted (see below). The parser never reads the investor's name, PAN, email, address, nominees or advisor codes; folio numbers, including other folios named in a gift transfer, are kept only as their last four digits. |
| NAV lookups | Your browser calls this site's own `/api/*`, which forwards to mfnav.in. Only public scheme codes, ISINs and dates are sent. |

## Remembering statements on a device (opt-in)

Off by default. When you choose "Remember on this device", every profile's parsed statement (the same masked data as in
memory, never the PDF or its password) is encrypted in the browser and stored in IndexedDB.

- **Key:** your passphrase (at least 12 characters, typed twice) goes through PBKDF2-HMAC-SHA256 with 600,000 iterations
  and a random 16-byte salt to an AES-256-GCM key. The key is a non-extractable `CryptoKey` held in memory only while the
  data is unlocked. The passphrase is used once and not kept.
- **Record:** version, iteration count, salt, IV and ciphertext. Nothing else, so profile names and folios are not readable
  from disk. Every save uses a fresh random IV. The salt is per vault, not per save (a new salt would need the passphrase
  again on every save).
- **Lock:** "Lock now", an idle timeout you choose (1, 5, 15 or 60 minutes) and reloading the page all drop the key and every
  statement from memory. Unlocking needs the passphrase again.
- **Forgotten passphrase:** the data cannot be recovered. Delete it and upload the statements again. Wrong passphrases and
  damaged records fail identically.
- **Not covered:** a malicious extension or XSS on this origin while unlocked, malware, a weak passphrase, and shared
  computers (do not enable it there). The NAV cache holds public data only and is separate.
- There is no encrypted export or import yet.

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
