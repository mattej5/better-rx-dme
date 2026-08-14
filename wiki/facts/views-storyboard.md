# Views Storyboard — every screen, including the boring ones

`[team]` 2026-08-14. Input for Claude Design. Phone-first for every persona ([[user-journeys]]). BetterRX tokens via `betterrx-design` skill. Plain-language everywhere (grandma rule).

## Positioning answer first: not an open marketplace

This is a **bring-your-own-vendors coordination layer** inside BetterRX, not an open marketplace. The hospice invites its already-contracted vendors (primary + secondary + fallbacks); compare/score/routing dynamics happen **within that curated list**. Vendor self-signup = network building = explicitly out of scope `[faq]`. Marketplace-style selection across the hospice's own vendors is exactly the sponsor's Amazon frame without the cold-start problem. Whether a nurse can pick a different vendor order-by-order under existing contracts is an open question ([open-questions.md](open-questions.md)) — demo assumes yes, labeled.

## Hospice side

1. **Role switcher (demo login).** Four persona cards with faces + titles instead of real auth. One tap drops the judge into that persona's world. Sets up the pitch ("now I'm the DON").
2. **Today (home), per role.** Nurse: today's admissions/discharges with readiness flags, anything at-risk on top. Case manager: my patients, anything needing action. DON: approvals waiting, at-risk count, month cost tile. One glanceable card stack, no navigation required for the 90% case.
3. **Patient roster.** Search + list synced from EMR (mocked ADT feed shown as "synced from HCHB" badge — integration credibility). Status chips: active / discharge scheduled / deceased.
4. **Patient equipment card.** Everything in this home right now: item photos, status chip per item (ordered → dispatched → in transit → delivered → pickup), next resupply due dates, big ORDER button, bigger PATIENT STATUS CHANGE button.
5. **New order flow (3 steps, <60s).** (a) Equipment picker grouped by [[dme-catalog]] categories, plain names + photos, "typical admission bundle" one-tap preset; (b) urgency (Admission/Routine/STAT) + target date-time ("must arrive before discharge, Fri 2:00 PM"); (c) **vendor compare** — the Amazon moment: per vendor one card with price, ETA, reliability score + condition score, hours badge ("open Sun"), stock assumption label. Place order. If over DON threshold: approval-request interstitial, order shows "awaiting approval."
6. **Order detail + timeline.** Vertical event timeline (ordered 9:02 → vendor confirmed 9:14 → dispatched → GPS ETA 3:40) with the comms thread inline — every SMS sent/received, agent-parsed interpretation shown under each free-text reply (explainability). Risk banner with plain-English reason + one-tap actions: nudge vendor / escalate / reorder from backup.
7. **Readiness board (admissions nurse).** Rows = upcoming admissions/discharges; columns = equipment items; cells = green/amber/red. The "nothing goes home without the bed" screen. Discharge blocked warning if anything red.
8. **At-risk alert + escalation sheet.** Push-style banner → bottom sheet: what's late, why ("ETA 5:10 PM vs discharge 4:30 PM; vendor hasn't confirmed since 1 PM"), options ranked: wait (agent keeps nudging) / call (tap-to-dial) / reorder from backup vendor with price delta shown. Human confirms; nothing auto-cancels.
9. **Bedside status-change flow.** Full-screen, gentle, two taps max: "Patient died" / "Patient discharged" → confirm → success screen with the receipt: "All 4 vendors notified at 2:14 AM. Equipment rental billing stopped. Pickup being scheduled with family." Timestamp huge. This screen IS the pitch cold-open.
10. **Pickup tracker.** Per item: notified ✓ (timestamp), scheduled (window), family contacted ✓, picked up ✓ (condition photo thumbnail). Elapsed-days counter turns amber at 24h, red at 48h `[assumed]` labels visible. "Family has called" pressure flag.
11. **DON approvals queue.** Card per pending order: item, price vs. cheapest alternative, requesting nurse, patient context. Approve / deny with reason. Guardrails hint ("under your $500 threshold items auto-approve" — threshold configurable, number is `[assumed]`).
12. **DON reports.** Three tabs: **Cost of care** (DME beside medication spend per patient + census, the BetterRX-only view); **Vendors** (scorecard list: reliability, condition, at-risk %, volume — synthetic label visible); **Saved** (equipment-days-after-death avoided, dollars, the billing-clock artifact).
13. **Vendor management (admin — the boring one that makes it real).** List of this hospice's vendors with status (active / invited / paused). **Invite vendor**: name + dispatch phone/email → sends magic link → status "invited." Vendor profile: coverage area, hours, equipment categories, price list (editable table, CSV upload stretch), contract notes field.
14. **Settings / guardrails.** SLA windows (urgent same-day / routine 24h, editable, `[assumed]` tag), DON cost threshold, escalation ladder timing, notification preferences. Everything the assumptions ledger references, configurable — that's the guardrails philosophy made visible.

## Vendor side (all magic-link, zero login)

15. **Vendor onboarding accept page.** From invite link: confirm business name, dispatch phone, hours, coverage, equipment categories (checkboxes from catalog). One screen, one confirm. This is the entire "how vendors join" answer — hospice-initiated, 60 seconds, no account.
16. **Run list (today).** Deliveries + pickups as stop cards sorted by window. Header: date + hospice name. Forwardable link (dispatcher texts it to driver — stated on screen: "share with your driver").
17. **Delivery stop card.** Address (tap for maps), patient first name + apt notes, items with photos, window, hazmat badge for O2, buttons: On my way (starts GPS opt-in prompt) / Delivered → capture signature + photo → done. Decline path asks reason (feeds score honestly).
18. **Pickup stop card.** Same shape + family-coordination note ("family prefers after Tue funeral" — agent-gathered), condition photo required, sanitization-flow reminder line.
19. **Vendor report card.** Public-ish no-login page: reliability + condition scores with the transparent formula shown, on-time %, order volume won this month, proof-pack archive (downloadable PODs for billing). The "this makes you money" screen.

## Shared / meta

20. **Family status link (stretch, no login).** "Your hospital bed arrives today 2–4 PM" / "Pickup scheduled Tuesday 10 AM — reply to reschedule." Addresses the brief's "hospice and family notified."
21. **Demo control panel (build this early — the pitch depends on it).** Hidden route: reset seed, jump scenario states (make DME-10305 go at-risk NOW), advance clock, simulated SMS inbox for the agent loop when real SMS is offline, QR code that opens the vendor magic link on a judge's phone.
22. **Assumptions ledger page.** Linked from every screen footer ("assumptions" link). The honesty artifact, in-product, not just a slide.

Related: [[user-journeys]], [[dme-catalog]], [[vendor-value-prop]], [[pitch-plan]]
