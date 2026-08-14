# ADR 0002 — Demo spine: hospice-first, magic-link vendor, no org model

Date: 2026-08-14 · Status: accepted · `[team]`

## Decision

Center of gravity is the **hospice-side app** (nurse ordering with price/ETA/reliability compare, readiness board, bedside pickup trigger, DON dashboards). The vendor side is **magic-link only**: a no-login run-list page per dispatcher (confirm/decline, GPS opt-in, photo capture) plus a no-login vendor report card. **No** vendor org model, multi-location radii, driver accounts, or inventory management UI.

## Why

- FAQ: judging weight sits primarily hospice-side; baseline vendor persona never logs in; network building out of scope.
- Redo pattern ([[vendor-value-prop]]): win the hard-to-acquire party by making adoption free and zero-effort. A dispatcher portal rebuilds the adoption wall.
- Trucker Tools "Text to Track" proves the phone-number-in, magic-link-out mechanic ships in the real world ([[why-deliveries-fail]]).
- 24-hour scope: the transcript's vendor org model (multi-location, drivers, 500-code inventory) risks two half-products.

## Consequences

- Vendor inventory is assumed/synthetic; the live-inventory seam is drawn in the architecture diagram but not built (`[faq]` says design the seam).
- The "hardest part" vendor features from the brief are addressed through the magic-link surface + proof packs, not a portal.

Supersedes the vendor-platform lean in the 2026-08-14 planning transcript.
