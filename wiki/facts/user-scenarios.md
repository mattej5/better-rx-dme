# User Scenarios — Case Manager and At-Risk Detection

Real-world flows that illustrate how our product solves the core problems. These are the moments that define differentiation from phone/fax ordering. `[kickoff-qa]` `[order-lifecycle]`

---

## Scenario 1: Case Manager Ordering On-Demand (Routine, Phone)

**Who:** Sarah, case manager. **When:** Tuesday 10 AM. **Device:** Phone, in the patient's home.

**Context:** Sarah visited Mr. Chen, spoke with hospice doctor at IDT meeting — they agreed he needs a wheelchair now. Discharge is Thursday afternoon.

### The user flow:

1. **Open app on phone** → Tap "New Order"
2. **Auto-fill patient** (from current visit context or quick search for Mr. Chen)
3. **Select equipment** → Search HCPCS → "E1130 – Wheelchair"
4. **Set urgency & deadline** → "Routine," target Thursday 2:00 PM
5. **See price + availability from multiple vendors in real-time:**
   - Vendor A: $200, in stock, 24-hr delivery ✓
   - Vendor B: $180, in stock, 48-hr delivery (misses deadline)
   - Vendor C: $210, out of stock, 5-day backorder
6. **Choose Vendor A** (best price + meets deadline) → Tap "Confirm"
7. **Receive SMS confirmation** with tracking link (can forward to family)
8. **Watch real-time status bar:** Ordered → Dispatched → In Transit (ETA 2:15 PM Wed) → Delivered

### Why this beats today:
- **Visibility:** Sarah knew price and ETA before confirming, not after. Today: she calls vendor, waits on hold, vendor says "maybe Wednesday."
- **Selection:** She chose the vendor that actually meets the deadline. Today: locked to primary vendor, pray it works.
- **Confidence:** She can proactively tell the family "equipment arriving Wednesday afternoon" instead of being surprised Friday when it's late.

---

## Scenario 2: At-Risk Detection (The Core Differentiator)

**Who:** Sarah, case manager. **When:** Tuesday 2:00 PM. **Device:** Phone.

**Situation:** Mr. Jones is dying Thursday 4:30 PM. His oxygen concentrator (E0601) was supposed to arrive by then. Order placed Monday. Now it's Tuesday 2 PM. ETA shows **5:10 PM Thursday** — **misses discharge by 40 minutes.** ⚠️

### The app shows (what today doesn't):
- **Red at-risk badge** on the order card immediately
- **Reason why:** "Delivery ETA 5:10 PM, discharge 4:30 PM — 40 min delay"
- **Time remaining to fix it:** "6 hours to contact vendor or switch"

### What Sarah can do right now:
- **Tap "Call Vendor"** → Phone number + quick note attached to the order ("Patient discharge 4:30 PM — can you pick up from warehouse?")
- **See alternatives** → "Vendor B has E0601 in stock, 24-hr delivery" — can reorder with them
- **Notify family proactively** → "Equipment may arrive slightly late; here's what we're doing" (message template in-app)
- **Escalate to DON** → One tap flags it for approver ("High-cost order at risk")

### Why this is the product:
- **Today:** Sarah finds out Thursday 4:15 PM (patient's family calls, vendor finally picks up). Too late. Equipment delayed. Patient goes home without oxygen. Hospice blamed for vendor failure. CAHPS score hit.
- **With app:** Sarah knows Tuesday at 2 PM — hours to fix it. Failure prevented. Hospice avoids reputation damage and denial-claim documentation gap.

**This scenario appears in the brief as DME-10305.** If the demo doesn't handle it visibly, it hasn't solved the core 25% of the rubric (addresses core user problems). `[order-lifecycle]`

---

## Scenario 3: Post-Death Pickup Automation

**Who:** Case manager (Sarah again). **When:** Tuesday 7:05 AM. **Device:** Any (system-driven, not user-initiated).

**Situation:** Mr. Chen dies. His EMR status flips to "Deceased." He has two active DME orders: E1130 wheelchair, E0601 oxygen concentrator.

### What happens automatically:
1. **EMR status change → System detects "Deceased"**
2. **Both orders auto-triggered for "Pickup Requested"**
3. **Vendor notified via SMS + email:** "Patient PT-88502 status changed to deceased. Equipment [list] ready for retrieval. Please schedule pickup by end of business Wednesday."
4. **Family notified via SMS:** "Your equipment will be picked up by end of business tomorrow."
5. **Sarah's app shows:** "Pickup Triggered" status on both orders, ETA for pickup, vendor contact if she needs to follow up.

### Why this solves the problem:
- **Today:** A nurse manually calls the vendor. Vendor voice line has a 30-minute hold. Gets through Friday. Equipment sits in grieving family's home 3+ days. Family calls hospice asking "when is this being removed?" Hospice blamed. Hospice pays additional rental day(s). Bad CAHPS score.
- **With app:** Pickup triggers automatically on EMR change. Vendor has 24–36 hours to pick up. Family knows pickup is scheduled. Equipment gone by Wednesday. Family's pain minimized. Hospice cost controlled. Reputation protected.

**This scenario appears in the brief as DME-09911 (Pickup Triggered) and DME-09803 (Pickup Delayed).** Handling both states is required. `[order-lifecycle]`

> **Alignment note (Vin/Claude, 2026-08-14):** sponsor's stated preference makes the **nurse-initiated bedside trigger the primary path** and the EMR status change the redundant fallback — BetterRX saw the EMR-only path fail in production ([constraints-and-assumptions.md](constraints-and-assumptions.md)). Demo shows the bedside button first (see [[views-storyboard]] view 9), with this EMR-driven flow as the automatic backstop. Also: the timestamped vendor notification stops the rental billing clock — that's the money moment ([[reverse-logistics-and-pickup]]).

---

## The Three Decision Factors (How the UX Proves It)

Every order screen must make these visible and comparable:

1. **On Time?** — Will equipment arrive before deadline? ✓ Green or ⚠️ Red (At Risk)
2. **Price?** — What does it cost? Shown per vendor, before committing.
3. **Selection?** — Which vendor? Multiple options shown, not locked in.

**Mental model:** Amazon for DME. Same wheelchair; see price, ETA, vendor choice. And get a red flag 2 hours before failure, not a phone call after. `[kickoff-qa]`

---

## Source annotations

- Personas and order-lifecycle scenarios drawn from `wiki/facts/order-lifecycle.md`, `wiki/facts/personas.md`, `wiki/facts/problem.md`.
- At-risk detection requirement from sponsor: "Service-failure risk scoring, surfacing an at-risk order before it's late — Differentiator" `[brief]` and "A risk signal should fire here if delivery won't beat a deadline." `[order-lifecycle]`
- EMR integration assumption: "Pickup-triggered state ideally tied to an EMR status change rather than a manual call" `[order-lifecycle]`.
