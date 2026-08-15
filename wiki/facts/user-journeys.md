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
- **DME PPD** (header says exactly that — the buyer's metric, [[ppd-answer]]) — DME spend ÷ census-days as the headline number beside Med PPD, per-patient breakdown below (BetterRX-only gap #3), plus **equipment-days-after-death counter** (dollars saved by the notification clock)
- CAHPS-risk proxy: count of late deliveries + delayed pickups this month ([[why-deliveries-fail]] — framed as "we believe these land on Q5/Q6/Q7")

## 4. Vendor dispatcher — never logs in

Journey: SMS arrives → taps magic link → today's run list → confirms deliveries/pickups, opts into GPS, uploads POD photo at the door → gets paid faster because the proof pack is complete.

**Dashboard artifacts (all magic-link, zero login):**
- **Run list** — today's deliveries + pickups with windows, confirm/decline, GPS opt-in (Text-to-Track mechanic)
- Per-stop card — address, equipment, signature + photo capture
- **Report card page** — reliability score, order volume won this month, proof-pack archive for billing ([[vendor-value-prop]] — score as revenue asset)

## Connector journeys (cross-persona and edge flows — added 2026-08-14 after due-diligence pass)

- **DON approval loop.** Order exceeds cost threshold → nurse sees "awaiting approval" chip → DON approvals queue (price vs alternative) → approve/deny with reason → nurse notified, order proceeds or returns. Crosses nurse↔DON.
- **Vendor onboarding.** Hospice admin invites (name + dispatch phone) → magic link → vendor confirms hours/coverage/equipment categories on one screen → appears in compare view. The whole "how vendors join" answer ([[views-storyboard]] view 15).
- **Vendor declines / reroute.** Vendor declines with reason (feeds score honestly) → agent auto-offers to next-best vendor from compare ranking → nurse one-tap confirms the switch. The multi-vendor safety net in action.
- **Live discharge.** Same pickup mechanics as death (notify → clock → schedule → photo), different copy and tone — patient is alive and may return to hospice later. Death and discharge are distinct status changes ([[user-scenarios]]).
- **Resupply loop.** Consumable interval due → reminder on patient equipment card → one-tap reorder → normal delivery flow, no pickup. Deterministic ([[dme-catalog]]).
- **Pickup Delayed escalation.** 24h amber / 48h red (`[assumed]`) → agent re-nudges vendor → "family has called" pressure flag → surfaces on DON reports as a **worked recovery queue** (ranked list with next action per item, CHEP pattern — [[vendor-value-prop]]), not a passive dashboard. What happens when the happy path fails. **No backup-vendor path for pickups** — the owning vendor must retrieve its own equipment (team call 8/14 PM), so the only levers are the nudge ladder (start of window / halfway / deadline-approaching), score damage, and the idle-inventory incentive. Reroute-to-backup applies to DELIVERIES only.
- **Family notified on time changes.** If a delivery window shifts or a vendor is swapped, the family is notified of the TIME change (they must be home); the vendor's identity is irrelevant to them. Tony's rule, team call. `[team]`
- **Replacement request (team call 8/14 PM).** Equipment arrives dirty/damaged/not working → nurse's condition report offers "Request replacement" → same vendor redelivers first (they eat the second trip — the real incentive, stronger than the score), backup vendor if declined or late → patient gets working equipment, vendor learns to deliver right the first time. `[team]`
- **Urgency escalation.** Patient status change (condition worsens) shifts an order's needed-by date earlier → all open orders re-run the at-risk rules against the new deadline → nurse sees which orders just went amber. High-risk items (high-cost OR time-critical like oxygen) carry a risk-adjusted lead-time buffer — flagged earlier than routine items. `[team]` second planning transcript.

Related: [[pitch-plan]], [[0002-demo-spine]], [[views-storyboard]], [personas.md](personas.md)
