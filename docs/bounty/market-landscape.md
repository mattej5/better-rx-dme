Competitive and Market Landscape | BetterRX DME Bounty

      Builder Day Bounty

    Competitive and Market Landscape

    Background on how DME moves through hospice today, and where the EMR ecosystem already touches it, for teams building on the DME Ordering and Visibility bounty.

    Back to bounty brief

  Landscape
  Who plays in this space

  DME in hospice is served by a mix of national platforms, regional and local vendors, and, increasingly, vendors that bundle DME with pharmacy benefit management under one contract. The category names below are for context. The analysis in this document is kept at the pattern level rather than attributed to any single company.

    National DME networks
    Regional and local DME vendors
    Combined DME + PBM platforms
    EMR-native DME modules
    Standalone DME ordering software

  Current State and Gaps
  How DME ordering actually works today

    Common patterns across the market

      Ordering happens through a vendor-specific portal, a phone call, or a fax, often all three depending on urgency and which staff member is placing the order.

      Pricing models vary. Some vendors take a spread between what the hospice is billed and what the vendor is paid for equipment. Others charge a flat per-patient-day rate with the vendor's margin built in more transparently.

      Vendor networks are typically curated rather than exclusive. Hospices commonly work two or more DME vendors per market so they have a fallback if one underperforms.

      Combined DME-plus-medication contracts are marketed on convenience and potential savings from bundling volume, but hospices frequently report skepticism that the bundled price beats what they could get contracting each piece separately.

    Where the gaps consistently show up

      Discharge-readiness risk. No shared, reliable signal that equipment will arrive before a scheduled discharge, so some hospices build in a buffer day out of habit rather than confidence.

      Post-death pickup delays. Pickup is usually triggered by a phone call after a death, rather than an automatic status change from the EMR.

      Fragmented visibility. Delivery tracking, where it exists, typically lives inside the vendor's own operational software and isn't surfaced back to the hospice in a usable way.

      Billing friction. DME claim denial rates run 15 to 25 percent, meaningfully higher than general medical billing, largely from documentation gaps rather than coverage disputes.

  Where AI Is (and Isn't) Already Applied
  Precedent in adjacent hospice use cases

  Predictive analytics is already established in hospice, just not yet aimed at DME logistics specifically, which is part of why this bounty is a relatively open lane.

    65 to 85%Typical accuracy range for hospice clinical risk models (readmission, mortality-risk, fall-risk type predictions) in published implementations

    15 to 25%Typical DME claim denial rate industry-wide, versus 5 to 10% for general medical billing

    20 to 35%Reported on-time delivery and delivery-capacity gains from AI-driven route and ETA optimization in general logistics contexts

  These figures are drawn from general logistics and adjacent healthcare predictive-analytics implementations, not DME-specific studies. Useful as a sanity-check benchmark for judging AI ROI claims, not a guarantee of what a hackathon prototype should achieve.

  DME Coding and Claims Standards
  What DME has instead of an ordering standard

  DME doesn't have a pharmacy-style e-prescribing standard for placing orders. Equipment itself is identified using HCPCS Level II "E" codes, the CMS coding set built specifically for durable medical equipment. There are over 500 of these codes; CPAP, code E0601, is the single most-fulfilled DME code nationally. On the billing side, DME claims run through the same ANSI X12 837 claims transaction standard used across healthcare generally, not a DME-specific one. There is no widely-adopted front-end ordering standard the way pharmacy has with e-prescribing, which is why most real DME integration today happens through each EMR's own partner-connection layer instead of a shared industry protocol.

  EMR Integration Landscape
  Where DME already touches the four target EMRs

  Unlike the competitor-specific detail above, this section names real integration patterns, useful context for the Integration Requirements section of the main brief.

    EMR	What exists today

    HCHB	Dedicated integration layer purpose-built to automate DME and supply ordering and share real-time patient status data with outside vendors.

    Axxess	Partner-connection model where patient updates sync automatically to a connected DME system for ordering and delivery tracking. Public API availability is inconsistently reported across sources.

    WellSky	Acquired a DME and HME software platform directly in 2024, folding equipment ordering and administration into its own stack rather than relying solely on third-party integrations.

    MatrixCare	Supports multiple DME-vendor integrations, including a bi-directional ordering interface with the leading DME-vendor software platform built directly into the hospice EHR.

  Public Data
  Reference datasets

      CMS Medicare DME, Devices and Supplies Public Use Files. Aggregate utilization, payment, and equipment-type data by HCPCS code, summarized by provider, not order-level.

      CMS Hospice Provider Utilization and Payment Public Use File. Aggregate hospice-level utilization, length of stay, diagnoses, and demographics.

      Sample DME Orders. A separate, synthetic, AI-generated set of example order records is linked from the Data Guidelines tab of the main brief, for teams who need a concrete transaction shape rather than aggregate statistics.

    Sources referenced in this briefing

      Homecare Homebase, Business Connect partner integration overview, hchb.com

      Axxess Hospice help documentation, Qualis DME Management integration, axxess.com

      WellSky press release, WellSky Acquires Leading DME/HME Software Provider Bonafide, October 2024, wellsky.com

      MatrixCare partner marketplace, Brightree HME/DME interface, matrixcare.com

      CMS Medicare DME, Devices and Supplies Public Use Files, data.cms.gov

      CMS Hospice Provider Utilization and Payment Public Use File, catalog.data.gov

      CMS HCPCS Level II E-code listing and DMEPOS coding guidance, cms.gov and hcpcs.codes

      Industry reporting on DME claim denial rates and billing complexity, tycoonstory.com

      Industry reporting on AI route optimization and ETA prediction ROI benchmarks (Tntra, X-Byte, RTS Labs)

      VNS Health, Improving Hospice Performance with Predictive Analytics (HVLDL case study), vnshealth.org

  BetterRX · Builder Day Bounty · August 2026