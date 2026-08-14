# User Journeys and Per-Persona Dashboards

`[team]` 2026-08-14, grounded in [personas.md](personas.md), [order-lifecycle.md](order-lifecycle.md), and the three required demo scenarios `[brief]`. Every user is effectively a first-time user — each screen must be self-explanatory to grandma's least technical friend `[kickoff-qa]`.

**Universal device rule (Vin, 2026-08-14): every screen for every persona must work as a web app on a phone.** Desktop is an enhanced layout for the DON, never a requirement. `[team]`

## The three demo scenarios ARE the journeys

| Scenario (deliverable E) | Persona driving | Order states exercised |
|---|---|---|
| 1. Discharge readiness | Admissions nurse | Ordered → Dispatched → Delivered |
| 2. Post-death pickup | Case manager | Pickup Triggered → (never) Delayed |
| 3. Service-failure prevention | Case manager + DON | In Transit → **At Risk** → resolved |

## 1. Admissions nurse — "nothing goes home without the bed"

Journey: patient admitted → picks equipment (plain-language names over HCPCS codes) + urgency → **vendor compare: price, ETA, reliability side-by-side** (the Amazon moment, [[competitor-products]] gap #2) → places order → watches readiness flag turn green before discharge.

**Dashboard artifacts:**
- **Admissions readiness board** — one row per upcoming admission/discharge: equipment list, ordered/confirmed/ETA vs deadline, a single green/amber/red readiness flag
- At-risk banner with the explainable reason ("vendor hasn't confirmed; ETA 5:10 PM vs discharge 4:30 PM") and one-tap escalate / reorder-from-backup
- Device: desktop at office, phone in field — build phone-first

## 2. Case manager — in the home, phone in hand

Journey: IDT prescribes → orders from the patient's home in under a minute → at the death: **one big bedside button ("Patient died — trigger pickup")** → timestamped vendor notification fires instantly (billing clock stops, [[reverse-logistics-and-pickup]]) → sees pickup scheduled with the family → condition photo confirms clean removal.

**Dashboard artifacts:**
- **Patient equipment card** — everything in this home right now, status of each item, order button
- Bedside trigger — unmissable, works at 2 AM Sunday, confirmation of "vendor notified at 2:14 AM" with the timestamp visible
- Pickup tracker — scheduled window, family contact status, "family has called" pressure indicator (sample order DME-09803)

## 3. DON — approver and reporter, desktop

Journey: high-cost order lands in queue → sees price compare + guardrails context → approves → monthly, reads vendor scorecards and cost reports to decide who keeps the business.

**Dashboard artifacts:**
- **Approvals queue** — high-cost orders with price context and one-click approve
- **Vendor scorecards** — reliability score, on-time %, condition score, at-risk frequency ([[0004-reliability-score]])
- **Cost of care** — DME spend beside medication spend per patient and census-wide (BetterRX-only gap #3), plus **equipment-days-after-death counter** (dollars saved by the notification clock)
- CAHPS-risk proxy: count of late deliveries + delayed pickups this month ([[why-deliveries-fail]] — framed as "we believe these land on Q5/Q6/Q7")

## 4. Vendor dispatcher — never logs in

Journey: SMS arrives → taps magic link → today's run list → confirms deliveries/pickups, opts into GPS, uploads POD photo at the door → gets paid faster because the proof pack is complete.

**Dashboard artifacts (all magic-link, zero login):**
- **Run list** — today's deliveries + pickups with windows, confirm/decline, GPS opt-in (Text-to-Track mechanic)
- Per-stop card — address, equipment, signature + photo capture
- **Report card page** — reliability score, order volume won this month, proof-pack archive for billing ([[vendor-value-prop]] — score as revenue asset)

Related: [[pitch-plan]], [[0002-demo-spine]], [personas.md](personas.md)
