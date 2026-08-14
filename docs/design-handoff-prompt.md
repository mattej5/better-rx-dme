# Claude Design Handoff Prompt

Paste everything below this line into Claude Design. Repo: https://github.com/mattej5/better-rx-dme

---

You are designing the UI for a 24-hour hackathon build: a hospice DME (durable medical equipment) ordering and visibility product for BetterRX, sponsor of a $10,000 bounty. Judging is tomorrow (Saturday) 2:00 PM. Design for real implementation in Next.js — practical screens, not concept art.

## The product in one line

Hospices get blamed for two moments they don't control: equipment arriving late for a discharge, and equipment sitting in a grieving family's home after a death. We give the hospice Amazon-style ordering visibility (price + ETA + vendor reliability at order time) and give the vendor a zero-login magic-link surface, connected by an SMS agent.

## Non-negotiable design rules

1. **Phone-first for every screen and every persona.** Desktop is an enhanced layout for reporting, never a requirement.
2. **Every user is a first-time user** (high nurse turnover). Sponsor's words: "think of your grandmother's least technical friend." Plain language everywhere; HCPCS codes shown small and secondary to plain names ("Hospital bed", not "E0260").
3. **Use BetterRX's own design language** — tokens measured from betterrx.com and the bounty brief they authored (in repo: `.claude/skills/betterrx-design/tokens.css`). Core: Poppins headings / Inter body; salmon `#EF7869` brand; slate ink `#24333F`; warm paper `#FBFAF8` (never pure white); cards white on warm paper, radius 10px; buttons radius 3px, weight 800, uppercase; secondary slate `#425B76`; status colors incl. at-risk red `#EB7870` on tint `#FBEAE9`. **Never set body text in salmon** (fails AA on white). Accessible salmon-family text color is `#8F4B22`.
4. **Honesty is a feature.** Synthetic data and assumptions are visibly labeled in the UI (small "synthetic data" / "assumed SLA" tags). An assumptions-ledger page is linked from every footer.
5. Warm, calm, unhurried tone — users include nurses standing in a home where someone just died. No gamification, no confetti, nothing cute on death-adjacent screens.

## Personas (4)

- **Admissions nurse** — orders equipment at intake; lives on the readiness board. Phone.
- **Case manager** — orders as condition progresses; presses the bedside status-change button at time of death. Phone, in the field.
- **Director of Nursing (DON)** — approves high-cost orders, reads cost/vendor reports. Phone-capable, desktop-enhanced.
- **DME vendor dispatcher/driver** — NEVER logs in. Entire experience is SMS + magic-link pages.

## Order lifecycle (drives every status chip)

Ordered → Dispatched → In Transit (**At Risk** overlay state) → Delivered → Pickup Triggered → (Pickup Delayed if overdue). The two failure states — At Risk and Pickup Delayed — are the product. Design them loudest.

## The 22 screens

Full descriptions in repo `wiki/facts/views-storyboard.md`; concrete walkthroughs with sample data in `wiki/facts/user-scenarios.md`. Priority order for design:

**P0 — the demo spine (design these first):**
1. **New order flow** (3 steps, <60s): catalog picker grouped by category with photos + "typical admission bundle" preset → urgency (Admission/Routine/STAT) + target date-time → **vendor compare cards**: price, ETA vs deadline (✓ meets / ✗ misses), reliability score, condition score, "open Sundays" badge, stock label. The Amazon moment — this screen wins the pitch.
2. **At-risk escalation sheet**: red badge on order card → bottom sheet: plain-English reason ("ETA 5:10 PM vs discharge 4:30 PM — misses by 40 min"), time-left-to-fix, ranked actions: wait (agent keeps nudging) / tap-to-call vendor / reorder from backup with price delta.
3. **Bedside status-change flow**: full-screen, gentle, two taps ("Patient died" → confirm) → receipt screen: "All 4 vendors notified at 2:14 AM · Rental billing stopped · Pickup being scheduled with family." Timestamp is the hero element.
4. **Vendor magic-link run list + stop cards**: today's deliveries/pickups sorted by window; per-stop: address, items with photos, hazmat badge on oxygen, buttons On My Way (GPS opt-in) / Delivered (signature + photo capture); pickup stops add condition photo + family-coordination note. "Share with your driver" link forwarding. A judge opens this on their own phone via QR.
5. **Order detail + timeline**: vertical event timeline with the SMS thread inline; under each free-text vendor reply, the agent's parsed interpretation ("→ delayed ~2h, reason: traffic") for explainability.
6. **Patient equipment card**: everything in the home now, per-item status chips, next resupply dates, big ORDER button, bigger PATIENT STATUS CHANGE button.

**P1:** Today home (per-role card stack) · readiness board (admissions × equipment grid, green/amber/red) · pickup tracker (timestamps, elapsed-days counter ambering at 24h, "family has called" flag) · DON approvals queue · DON reports (cost-of-care: DME beside medication spend; vendor scorecards; equipment-days-saved counter) · vendor report card (scores + formula shown + order volume won + proof-pack archive) · vendor onboarding accept page (one screen: confirm hours/coverage/categories).

**P2:** role switcher (4 persona cards, demo auth) · patient roster ("synced from HCHB" badge) · vendor management + invite flow · settings/guardrails (SLA windows, cost threshold — all labeled assumed) · family status link · assumptions ledger page · demo control panel (scenario jumps, clock advance, simulated SMS inbox, judge QR).

## Key demo moments the design must land

- Vendor compare: Vendor A $200 in-stock 24h ✓ / Vendor B $180 but misses deadline / Vendor C out of stock (sample data in user-scenarios.md).
- Sample order DME-10305: CPAP, STAT, ETA 5:10 PM vs discharge 4:30 PM → At Risk.
- Sample order DME-09803: bed, pickup triggered 4 days ago, family called twice → Pickup Delayed.
- The 2:14 AM receipt (billing clock stop) — the pitch cold-open.

## Positioning context (shapes copy, not layout)

Not an open marketplace: a bring-your-own-vendors coordination layer. The hospice invites its contracted vendors; compare/score happens within that list. Reliability score is a flywheel ("good vendors win more orders"), not a punishment — vendor-facing copy must read as opportunity, not surveillance.

## Repo resources

- `wiki/facts/views-storyboard.md` — all 22 screens, rich descriptions
- `wiki/facts/user-scenarios.md` — three walkthroughs with sample data
- `wiki/facts/user-journeys.md` — per-persona journeys + dashboard artifacts + six connector journeys (approval loop, vendor onboarding, decline/reroute, live discharge, resupply, pickup-delayed escalation)
- `docs/graph.html` — interactive system graph: every persona, view, engine part, and external system, with edges showing what feeds what (open in any browser, self-contained)
- `wiki/facts/dme-catalog.md` — the ~25 equipment items with categories/flags
- `wiki/facts/order-lifecycle.md` — six states + sample orders DME-10231…09803
- `wiki/facts/personas.md` — sponsor-verbatim personas
- `.claude/skills/betterrx-design/SKILL.md` + `tokens.css` — full design system with provenance
- `docs/bounty/original/dme-hackathon-bounty-brief.html` — BetterRX's own styling of this exact problem (their `:root` includes the status palette)

## Deliverables

Screen designs for the P0 six first, phone viewport (390×844), using the tokens above; then P1. Component patterns to reuse: status chip set (6 lifecycle states + at-risk/delayed variants), vendor compare card, event timeline row, stop card, big-action button, synthetic/assumed label tag.
