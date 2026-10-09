# Verax as a Rust core with a Tauri desktop app

Status: planned, not scheduled. No code exists. Decisions below were settled in a grilling session on 2026-10-09
(Q1-Q16). One fact is still being checked (see "Open items").

## Goal
- Offline use and a Rust-based codebase.
- Desktop app (Linux, Windows, macOS) that updates itself.
- The web app (Cloudflare Pages, Vercel) stays fully maintained.
- Audience: the owner and family. No paid OS signing certificates.

## Design

**One Rust core, two targets.** Domain maths (holdings FIFO, XIRR, timeline, chart), parser logic and the vault live in a
Rust crate. It compiles to WASM for the web app and links natively into Tauri. The TypeScript copies are deleted as each
module is ported, so features land once.

| Area | Decision |
|---|---|
| UI | Preact stays, shared by web and desktop. No Rust UI framework. |
| PDF reading, web | pdf.js stays. A small adapter turns its text items into the shared item type (string, baseline x, y, advance width, page). |
| PDF reading, desktop | Rust crate behind the same adapter. Chosen by a 2-day spike (below). |
| Vault | One Rust vault (`argon2` + `aes-gcm`) on both targets. The web build uses it through WASM. |
| Saved data | Desktop vault starts empty. Existing web users re-import their PDFs once (release notes say so). No migration code. |
| NAV fetching, desktop | Rust (`reqwest`). No CORS in a native app, so no proxy. Keep the 60 requests a minute limit and the cache keyed by scheme code and date. |
| NAV fetching, web | Unchanged: `proxy/core.ts` and its three wrappers. |
| Offline NAVs, desktop | After import, prefetch history for held funds (paced at 60/min). Past NAVs are immutable, so cache them for good and refresh only the latest. Stored in the app data directory with no scheme codes in file names or in the clear (inside the encrypted vault). |
| Offline NAVs, web | No persistent cache (more privacy surface). |
| Numbers | f64, as in TypeScript, so parity is exact. Units, FIFO lots and holdings match the existing test cases exactly. XIRR matches within 1e-9 relative. |
| Parser gate | 100% of transactions match casparser on real statements (today 1,636 of 1,636). The owner runs `tools/parser-oracle` in their own terminal; it reports counts and masked shapes only (`docs/parser-oracle.md`). |
| Repo | Cargo workspace inside this repo (for example `crates/core`, `crates/wasm`, `src-tauri`). `src/` stays. |
| Web WASM build | Built in GitHub Actions, with the `.wasm` and its JS glue committed (for example under `src/wasm/`). The hosts only run `vite build`. See "Host builds" below. |
| Web size budget | First load stays under 200 KB gzip. The WASM core is lazy-loaded (on opening a profile or importing a PDF). Revisit if the core is over about 300 KB gzip after `wasm-opt -Oz`. The 3 s warm-valuation budget stays. |

### Desktop PDF reader spike (2 days)
Implement the adapter for two candidates behind one trait and run the real-statement oracle:

| Candidate | For | Against |
|---|---|---|
| `pdfium-render` | Chrome's engine, most mature (~115k weekly downloads), good encryption support | Ships a C++ PDFium binary per OS to bundle and sign. Reports glyph boxes, so right edges shift slightly. Cannot tell "needed" from "wrong" password (try no password first). |
| `pdf-extract` + `lopdf` | Pure Rust (~240k and ~870k weekly), widths from font metrics like pdf.js | We write the character-grouping layer. Older text-positioning code. |

Ruled out: `mupdf` (AGPL-3.0, no WASM), `lopdf` alone, `pdf` (pdf-rs) and `hayro` (no positioned text), and `pdf_oxide`
(young, API still changing, ~70k weekly, under the 100k bar).
The parser reads only string, baseline x, y and advance width per item, builds its own lines (2pt) and columns (3pt),
so how a library splits text barely matters. Baseline-versus-glyph-box and advance width do. The winner is whichever
matches casparser on every real transaction.

Every candidate is single-owner on crates.io, which breaks the CLAUDE.md rule against single-maintainer packages that
touch file I/O. The owner waives the rule for the one chosen crate; record it in `docs/adr/`.

### Updates
- Tauri updater (`tauri-plugin-updater`), releases on the public repo's GitHub Releases.
- Signing key: GitHub Actions secret with a passphrase, plus an offline backup. A lost key strands every installed copy.
- Check on launch, prompt before installing, never install silently (financial software).
- No paid OS certificates: Windows shows SmartScreen and macOS needs right-click then Open on first install; updater
  updates after that do not. Document the first-install steps in the README.
- Version `<major>.<unix_seconds>.0` is valid semver for Tauri.

### Host builds
Researched 2026-10-09 from each host's docs. Neither host ships a Rust toolchain or caches `~/.cargo` and `target/`
(Cloudflare: 20-minute build limit, memory undocumented; Vercel Hobby: 2 vCPU, 8 GB, 45 minutes, cache not
configurable; Vercel's "no Rust" is likely but not confirmed). Building Rust inside the hosts would reinstall and
recompile on every build, and install and compile times are unmeasured. So:
- GitHub Actions builds the WASM and the artifact is committed. Cloudflare and Vercel need no changes.
- A new CI job runs `cargo test`, rebuilds the WASM and fails if it differs from the committed file. Without it a Rust
  change that breaks its own tests could still deploy, because the hosts only test the JS side and so the rule
  "a failing test blocks a deploy" would no longer hold. It probably needs more than `ci.yml`'s 10-minute timeout.
- Publishing the WASM to npm instead is not planned: it brings in the CLAUDE.md dependency rules (exact version, lockfile).

## Phases and effort (one developer, working days)

| # | Phase | Days |
|---|---|---|
| 0 | Cargo workspace and golden fixtures taken from the existing TS tests | 2-3 |
| 1 | Tauri shell around the current app, Rust NAV client, updater, 3-OS CI and release pipeline | 9-12 |
| 2 | Rust domain core (holdings, XIRR, timeline, chart), WASM build on the web, TS copies removed | 7-10 |
| 3 | Rust vault on both targets, web re-import notice | 3-4 |
| 4 | Reader spike (2), parser logic port, desktop adapter | 13-18 |
| 5 | Desktop NAV disk cache and post-import prefetch | 2-3 |
| 6 | UI data-layer swap, remove pdf.js from desktop and dead TS | 3-4 |
| 7 | Docs, PRD, CLAUDE.md, ADR, release runbook | 2 |
| | **Total** | **41-56 days, about 8-11 weeks** |

Order: phase 1 first, so a working auto-updating desktop app exists after about 2-3 weeks and the signing and CI
problems show up before the large port. Phases 2-6 then ship as ordinary updates.
The estimate is rough: the parser (phase 4) is the main uncertainty, and a fully native Rust UI (not planned) would add
3-4 weeks.

## Risks
- Parser parity on real statements (synthetic fixtures cannot reveal it, per the CLAUDE.md failure log).
- Web build tooling: the hosts need a Rust toolchain to build WASM (open item below).
- WASM size against the 200 KB budget.
- Two PDF readers (pdf.js on web, a Rust crate on desktop) feeding one parser: the adapter contract needs its own tests.
- Update-signing key custody.

## Open items
- **Number type:** f64 chosen for parity; revisit only if money rounding errors show up in the real-statement check.

## Verification (when built)
- `cargo test` passes the golden fixtures; the same fixtures pass for the WASM build in the browser.
- Real-statement parser check via `docs/parser-oracle.md` in the owner's terminal.
- Update test: install build N, publish N+1 to a test release, confirm the prompt, install and relaunch.
- Web: `scripts/smoke.sh <url>` and the first-load size check against 200 KB gzip.
- Privacy: `npm run scan`, a strict Tauri CSP, and no network egress except mfnav.in.
