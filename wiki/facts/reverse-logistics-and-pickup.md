# Reverse Logistics and Post-Death Pickup

Research pass 2026-08-14, web sources. Tag: `[research]` = verified against a cited external source by us, not sponsor material.

## The billing-stop clause — the sharpest lever we found

Standard model hospice/DME agreement (Jeffrey S. Baird, Brown & Fortunato, Medtrade 2022): rental billing continues until the **earliest of** (a) the date the hospice *notifies* the supplier of transfer/discharge, or (b) the date equipment is picked up if the supplier was never notified. Late notification = billing stops at notification date, not the actual death date. `[research]` — verified first-hand at [medtrade.com](https://medtrade.com/news/billing-reimbursement/hospice-dme-supplier-agreement-key-provisions/)

Implications:
- Every hour between death and provable notification is equipment-days the hospice eats from its per-diem. The hospice's money lever is **fast, timestamped, provable notification** — pickup speed is mostly the *vendor's* cost problem. Serve both separately.
- The same model contract puts the hospice's notification duty as a **daily business-day batch list**. Deaths happen nights and weekends. That gap is the wedge for [[user-journeys]] scenario 2.
- Caveat: this is *recommended* contract language from one well-regarded healthcare attorney, not a measured industry standard. Label accordingly. `[research]`

## Why the truck doesn't come

- A pickup is a one-way trip that generates no revenue and ends a revenue stream. VGM's HME Delivery Cost Survey documents delivery cost per truck roll on the order of $100–200 (snippet-level; gated PDF — do **not** cite exact figures on a slide). Batching/deferring pickups is rational vendor economics, not negligence. Frame it that way to judges. `[research]`
- Hospice pays DME out of its Medicare per-diem (42 CFR 418.202(f)); supplier bills the hospice, not Medicare. HHS OIG found ~$117M in improper Part B payments for DME during hospice over 4 years — the boundary is actively mis-billed at scale. `[research]`
- Trap: Medicare Part B capped-rental "full month on death" rules do **not** apply to hospice DME (private per-item contract). Conflating them in the pitch is a checkable factual error.

## Returned equipment can't go straight back out

ACHC DMEPOS standards require documented infection-control protocols, FDA-registered/EPA-approved disinfectants, and cleaning/maintenance records for reissued items. FDA regulates reprocessing of reusable devices. So every return runs a quarantine → clean → document → restock cycle. `[research]`

**Pitch point:** equipment stuck in a dead patient's living room is also equipment unavailable for the next admission. Pickup delay is an inventory-availability problem, not just a family-experience problem.

## Oxygen is a special path

Medical oxygen is DOT hazmat + FDA prescription drug. Shipping papers in reach on every transport, ERG in vehicle, hazmat training (90 days of hire, refresh every 3 years). No generic-courier fallback; cylinders and concentrators may need different retrieval paths. Handling this correctly in the demo is a credibility signal. `[research]`

## No source exists for

- Any published pickup SLA benchmark (24/48h figures are contract-negotiation advice — label `[assumed]`)
- Measured post-death pickup delay distributions
- Pickup-specific reverse-logistics cost data
- Lost-equipment write-off rates

Related: [[why-deliveries-fail]], [[competitor-products]], [[vendor-value-prop]], [problem.md](problem.md)
