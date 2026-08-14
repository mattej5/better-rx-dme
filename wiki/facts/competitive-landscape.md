# Competitive and Market Landscape

Condensed from `docs/bounty/market-landscape.md`. `[landscape]` unless noted.

## Who plays

National DME networks · regional and local DME vendors · combined DME + PBM platforms · EMR-native DME modules · standalone DME ordering software. The sponsor kept the analysis at pattern level rather than naming companies. StateServ and Dragonfly are named in the FAQ as reference points BetterRX positions against. `[faq]`

## How ordering works today

- Through a **vendor-specific portal, a phone call, or a fax** — often all three depending on urgency and who's placing the order.
- **Pricing models vary.** Some vendors take a spread between what the hospice is billed and what the vendor is paid. Others charge a flat per-patient-day rate with margin built in more transparently.
- **Vendor networks are curated, not exclusive.** Hospices commonly work two or more DME vendors per market so they have a fallback when one underperforms. But in practice they're locked to a primary and maybe a secondary. `[kickoff-qa]`
- **Combined DME + medication contracts** are marketed on convenience and bundled-volume savings. Hospices frequently report skepticism that the bundled price beats contracting each piece separately.
- **Nationals only work Monday–Friday, 9–5.** `[brief]`

## Where the gaps consistently show up

1. **Discharge-readiness risk** — no shared, reliable signal that equipment will arrive before a scheduled discharge, so some hospices pad a buffer day out of habit rather than confidence.
2. **Post-death pickup delays** — pickup is usually triggered by a phone call after a death, not an automatic status change.
3. **Fragmented visibility** — delivery tracking, where it exists, lives inside the vendor's operational software and isn't surfaced back to the hospice in a usable way. GPS and proof-of-delivery capture do exist in DME/HME operational software. `[brief]`
4. **Billing friction** — 15–25% DME claim denial rate, largely documentation gaps.

## What's shifting

- **EMR platforms are building or acquiring DME capability directly** rather than leaving it to third-party integrations. WellSky acquired Bonafide in 2024.
- **Predictive analytics is established in hospice** for clinical risk (length-of-stay, mortality, fall risk) but is **rarely applied to DME logistics.** The sponsor calls this "a relatively open lane." That's the AI opening.

## Sponsor's read on the field

At kickoff, unprompted: *"I've gotten to see DMEs and DME technology. I haven't seen anything great."* The bar for differentiation is lower than it looks, but the 30% differentiation weight means we still have to name what today can't do. `[kickoff-qa]`

## Differentiation angles worth considering

Not decisions, just the surface area the sponsor left open. `[assumed]`

- **Price + ETA + stock visible at the moment of ordering** (the Amazon comparison the sponsor made himself) against today's fax-and-hope
- **Multi-vendor selection** against single-vendor lock-in
- **Pre-emptive risk scoring** — flag the order that will be late *before* it's late, with an explainable reason
- **Nurse-initiated pickup at the bedside** against a phone call after the fact
- **DME spend beside medication spend** in one total-cost-of-care view — only BetterRX can do this, since they already own the medication side
- **Guardrails for DME** — encode the hospice's philosophy of care so a new nurse defaults correctly (the sponsor's existing pharmacy feature, no DME equivalent exists)
- **Equipment condition attestation** — not required, explicitly flagged as a strong differentiator given how hard it showed up in discovery `[faq]`
