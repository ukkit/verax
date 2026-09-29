# Future enhancements (not scheduled)

Ideas discussed for Verax that have no code yet. The scheduled work is in [../PRD.md](../PRD.md) (milestones).
When one ships, move its doc to `docs/completed/`.

- **Portfolio value over time chart.** Needs the daily NAV of every fund back to the first purchase; heavy on the mfnav.in API.
- **LTCG / STCG tax reports.** FIFO lots (already the cost-basis rule) make this a reporting layer, not a rewrite.
- **Combined household view** across profiles (v1 keeps each profile separate).
- **NSDL / CDSL demat statements** (v1 supports CAMS and KFintech detailed CAS only).
- **Docker image** for the local run mode.
- **Second NAV source** (AMFI `NAVAll.txt`) if mfnav.in proves unreliable; the proxy is the single swap point.
- **mfnav.in API keys**, once the service offers them.
