# Differentiation (deliverable C)

30% of the rubric. One page: what this does that phone, fax, and a vendor portal do not, and what it does that the shipping products do not.

**Framing rule, applied everywhere below.** We say "we found no public evidence that X does Y." We never say "nobody does this." Most of what we could read is vendor marketing, and absence of evidence is not proof of absence. Research pass 2026-08-14, `[research]`, sourced in `wiki/facts/competitor-products.md`.

**Two things we are not claiming.** Mobile nurse ordering and multi-vendor selection are **not** differentiators. Qualis publicly claims both. We struck them from our own angle list once we found that out, and we will strike them on stage before a judge does.

---

## The field, briefly

| Product | What is verified | What we found no public evidence of |
|---|---|---|
| **Qualis** | Hospice-specific DME management. 12 EMR integrations including HCHB, Axxess, WellSky, MatrixCare. Mobile nurse ordering, multi-vendor selection, real-time order visibility, window-elapsed delivery flagging, auto pickup trigger on discharge | Predictive flagging before a window elapses. Price shown to the nurse at order time. Their published answer to vendor non-compliance is a **managed-service layer**: if a vendor does not confirm, their management team follows up |
| **Dragonfly Health** (StateServ, Hospicelink, Delta Care Rx) | 1,300+ DME provider locations, 21 distribution centers, DMETrack platform for ordering, tracking, billing. Acquired Enclara Pharmacia (~2025), so DME plus hospice pharmacy | Hospice-facing ETA, a pickup workflow, at-risk flagging, or price transparency on public pages |
| **Brightree** (ResMed) | Mobile Delivery gives **dispatchers** route optimization, calculated ETAs, real-time status, POD with signature/timestamp/geocode, and driver photos of item condition | Any of that surfaced to the hospice. VirtueRN gives facilities order-level visibility into Brightree but says nothing about ETA, live status, or pickup |
| **WellSky + Bonafide** (acq. Oct 2024) | Bonafide is supplier-side ERP, roughly 200 clients. WellSky owns both ends of the pipe | A shipped hospice-agency-facing DME module inside WellSky Hospice, roughly 18 months after close |
| **Parachute Health** | Largest DME ePrescribing network, ~300k clinicians, under 1 day median order-to-delivery. AI for fax intake and documentation-gap flagging | Hospice as a named care setting, or any pickup/retrieval feature. Built around payer-billed DME (prior auth, coverage checks); hospice per-diem DME has neither |

**The single most useful finding.** The ETA, the GPS, and the condition photo **already exist**. They live in the vendor's dispatch software and are never surfaced to the hospice. Our gap is a **sharing gap, not a technology gap**. That is a much stronger and much more defensible claim than "this is hard to build."

---

## Capability table

| Capability | Phone / fax / vendor portal today | Shipping products | Us |
|---|---|---|---|
| **Nurse orders from the bedside** | Phone call, then a fax, then a callback | Qualis claims mobile nurse ordering `[research]` | Same. **Not a differentiator, and we say so** |
| **Choose among vendors** | Nurse calls whoever they always call | Qualis claims multi-vendor selection `[research]` | Same. **Not a differentiator** |
| **Price at the moment of ordering** | Invisible. The nurse learns the price on the invoice | No public evidence any product shows the nurse a per-vendor price before commit | Per-vendor price on the compare card, before the tap. Direct PPD lever |
| **Order status without a phone call** | Call the vendor. If it is after 5 PM, call again Monday | Qualis claims real-time order visibility `[research]` | Same visibility, different mechanism: it is derived from an append-only event log the vendor writes into by SMS |
| **Risk surfaced before the delivery is late** | Nothing. You find out when the family calls | Qualis flags when the window has already elapsed, which is reactive by construction. We found no public evidence of predictive DME delivery risk flagging anywhere | Five deterministic rules fire **before** the window elapses, weighted by urgency and by item. Oxygen goes amber earlier than a bed. Every flag carries a plain-sentence reason |
| **Vendor answers without logging in** | Phone tag with a dispatcher | Qualis's published answer is a **managed-service layer**: humans on their team follow up by phone `[research]` | We replace the phone call with a protocol. SMS plus magic link, a five-step nudge ladder, and the exhaust becomes a reliability score. The mechanic is copied from Trucker Tools "Text to Track," a shipping product in freight `[research]` |
| **Vendor status flows back into the hospice's system** | Nothing flows back | The Axxess to Qualis integration is a documented **one-way push**: the EMR pushes patient events out, no delivery status comes back. Third-party sourced, our strongest documented gap | `dmeStatusUpdate` posts back on every transition, so DME status sits on the same patient record as medications |
| **Condition of the equipment on arrival** | The nurse phones someone, or nobody hears about it | Brightree's driver captures a condition photo. We found no public evidence it is shared with the hospice `[research]` | One nurse tap at delivery (None / Dirty / Damaged / Not working), photo optional, feeding a condition score the vendor can see and dispute |
| **Post-death pickup** | Hospice notifies on a daily business-day batch list. A Saturday death is reported Monday `[research]` | Qualis's pickup trigger is tied to **discharge** on the page we read. Death-triggered with an SLA clock is not publicly claimed, but this is our **weakest** gap row and they may have closed it | Nurse taps at the bedside. The `pickup_requested` timestamp is written the same minute and shown large, because that timestamp is the billing-stop artifact |
| **Provable notification time** | A phone call leaves no record | No public evidence of a timestamped notification receipt in any product | The receipt screen prints the timestamp. Under the model hospice/DME agreement, rental bills until the earliest of the notification date or actual pickup `[research]`, so that timestamp is money |
| **DME spend next to medication spend** | Two invoices, two systems | Dragonfly now owns both DME and hospice pharmacy but markets them as separate platforms `[research]` | Structurally native. The DME event uses the same `meta` / `account` / `patient` envelope as an eRx medication event, with an HCPCS E-code where the medication carries an NDC |

---

## The three claims we would defend under cross-examination

**1. Predictive beats reactive, and the difference is stateable.** A window-elapsed flag tells you a delivery is already late. Rule R4 fires when there is no ETA yet and the remaining time is under the vendor's typical lead time plus a high-risk buffer, which is before anything has visibly gone wrong. The reason string is the proof it is not a black box: "Oxygen concentrator, no ETA yet. 5 hours to the 4:30 PM discharge; this vendor typically needs 4 hours plus a 2-hour safety buffer for oxygen."

**2. A protocol scales where a managed-service layer does not.** Qualis's own copy answers vendor non-compliance with people making phone calls. That works and it is honest, and it also costs headcount per order and generates no data. Our ladder costs about $0.026 in SMS per order (`docs/AI-APPROACH.md` §4) and every rung it climbs is an event that feeds the vendor's reliability score. The follow-up becomes the measurement.

**3. The billing clock is the PPD answer, and it is a contract clause, not a slogan.** The sponsor's buyer asked how we decrease DME PPD `[slack]`. Three levers, all built: pay less per order (price at compare), pay for fewer days (timestamped notification instead of Monday's batch list), and default cheap-but-right (guardrails and DON thresholds). The DON dashboard shows equipment-days avoided and dollars, with the 26-hour baseline labeled as the assumption it is (`docs/ASSUMPTIONS.md` #6). We demo the mechanism and the counter. We do not claim a percentage.

---

## What we would concede on stage

- Qualis exists, is hospice-specific, and has 12 EMR integrations we do not have. Ordering and multi-vendor selection are solved.
- Our death-triggered pickup gap is inferred, not verified. They may have shipped it since the page we read.
- Every score in the demo runs on synthetic history, because no DME delivery-timing data exists anywhere in shareable form `[faq]`. The formula is real, the events are not.
- We have zero vendor relationships, and neither does BetterRX today `[brief]` `[faq]`. That is why nothing in the design requires a vendor to install anything, create an account, or remember a password.

Sources: `wiki/facts/competitor-products.md`, `wiki/facts/why-deliveries-fail.md`, `wiki/facts/reverse-logistics-and-pickup.md`, `wiki/facts/ppd-answer.md`.
