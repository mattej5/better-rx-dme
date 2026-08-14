# Competitor Products — verified research

Research pass 2026-08-14. Tag `[research]`. Framing rule for the pitch: say **"we found no public evidence that..."**, never "nobody does this." Most sources are vendor marketing pages; absence of evidence ≠ proof of absence.

## Qualis — the real competitor; changes our plan

Hospice-specific DME management. Existence verified via Axxess's own help docs, HCHB partner page, NPHI preferred-vendor announcement (2022), named hospice customers. 12 EMR integrations incl. HCHB, Axxess, WellSky, MatrixCare. Claims: mobile nurse ordering (DME+), multi-vendor selection, real-time order visibility, window-elapsed delivery flagging, **auto pickup trigger on discharge**. `[research]`

Consequences:
- **"Multi-vendor selection" and "mobile ordering" are DEAD as differentiators.** Struck from [competitive-landscape.md](competitive-landscape.md) angles.
- The Axxess→Qualis integration is a documented **one-way push** (EMR pushes patient events out; no delivery status back into the EMR). Third-party sourced — our strongest documented gap.
- Their flagging is reactive threshold (window elapsed → flag), not predictive. Their pickup trigger is tied to *discharge* on the page read; death-triggered with an SLA clock is not publicly claimed — weakest gap row, they may have closed it.
- All `qualis.com/blog` content is vendor marketing; one checkable claim ("half of CAHPS focuses on DME") is **false**. Never cite that domain.

## Dragonfly Health (StateServ + Hospicelink + Delta Care Rx)

Corporate history verified via Oregon HCMO regulatory filing (best source in the pass): StateServ 2004 → Blue Wolf 2017 → WindRose 2021 → Dragonfly rebrand. 1,300+ DME provider locations, 21 distribution centers, 100k+ patients daily; DME in every state but Alaska, direct in 14. Platform = DMETrack™ (ordering/tracking/billing). **Acquired Enclara Pharmacia from Humana (~2025)** — now DME + hospice pharmacy, the same bundle BetterRX would build toward, but marketed as separate platforms. `[research]`

Not found on public pages: hospice-facing ETA, pickup workflow, at-risk flagging, price transparency. Sponsor's "someone died and StateServ wouldn't know" quote has **no public corroboration** — cite it only as `[kickoff-qa]` discovery.

## Brightree (ResMed) — the money finding

Brightree Mobile Delivery gives *dispatchers* route optimization, calculated ETAs, real-time status, POD with signature/timestamp/geocode, and **driver photos of item condition**. `[research]`

**The ETA, GPS, and condition photo already exist — they live in the vendor's dispatch software and are never surfaced to the hospice. Our gap is a *sharing* gap, not a technology gap.** VirtueRN (verified, real) gives facilities order-level visibility into Brightree but says nothing about ETA, live status, or pickup.

## WellSky + Bonafide (acq. Oct 2024)

Bonafide is supplier-side ERP (billing, inventory, delivery), ~200 clients. No evidence of a shipped hospice-agency-facing DME module inside WellSky Hospice ~18 months post-close. WellSky owns both ends of the pipe and hasn't visibly connected them for the hospice user. Good pitch line — hedge it. `[research]`

## Parachute Health

Largest DME ePrescribing network (~300k clinicians, <1 day median order-to-delivery). AI used for fax intake/documentation-gap flagging. Built around **payer-billed** DME (prior auth, coverage checks) — hospice per-diem DME has neither; hospice not named among their care settings. Less threat than it looks; pressure-test this. No pickup/retrieval features found. `[research]`

## Surviving differentiation whitespace

| # | Gap | Confidence |
|---|---|---|
| 1 | Predictive at-risk flagging (before late, explainable) — zero examples of AI on DME delivery risk found anywhere | verified-absent |
| 2 | Price visible to nurse at order time | verified-absent |
| 3 | DME + med spend in one view (structurally BetterRX-only; Dragonfly window narrowing) | inferred |
| 4 | Condition attestation surfaced to hospice (Brightree captures it, never shares) | verified as sharing gap |
| 5 | Vendor status pushed back into hospice's system (Axxess↔Qualis is one-way) | verified — strongest |
| 6 | Death-triggered pickup + SLA clock + notification timestamp | inferred — weakest |

Related: [[reverse-logistics-and-pickup]], [[why-deliveries-fail]], [[vendor-value-prop]], [order-lifecycle.md](order-lifecycle.md)
