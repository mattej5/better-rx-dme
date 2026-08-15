# Constraints and Assumptions

## Hard constraints

| # | Constraint | Source |
|---|---|---|
| 1 | **Synthetic data only.** No real patient info, no real hospice client data, nothing proprietary to an employer or prior project. | `[brief]` |
| 2 | **It has to run.** A clickable Figma flow or static demo doesn't count. A judge clicks through a real interaction. Backend can be as simple as needed. | `[brief]` |
| 3 | **Defend any AI.** Name the deterministic baseline and why AI beats it. An LLM standing in for a lookup table scores badly. | `[brief]` |
| 4 | **Vendor network building is out of scope.** Recruiting/activating vendors is the genuinely hard part and is explicitly not a hackathon problem. Assume vendor participation. | `[faq]` |
| 5 | **Fresh code.** Bounty submissions are expected to be new work for the event. | `[kickoff-logistics]` |
| 6 | **One track only.** Participants enter either BetterRX or the general hackathon, not both. | `[kickoff-logistics]` |

## Assumptions we are making, and must state out loud

Each of these is a gap the sponsor confirmed they cannot fill. Stating them explicitly is scored well; hiding them is scored badly. `[faq]`

**SLA / delivery windows.** No formally defined delivery-window standard exists — BetterRX holds no DME vendor contracts, so it's never been codified. Industry practice is a reasonable starting point: **same-day for urgent/STAT** (hospital bed, oxygen at admission) and **within 24 hours for routine**. Design against same-day-of-admission for urgent, with a configurable SLA for routine, and say so. `[faq]`

**Pickup window.** Post-death pickup should be "as immediate as possible, **within 24 hours**." The hospice pays for every day the equipment sits. `[kickoff-qa]`

**Vendor operations.** No vendor interviews were conducted. Dispatch, driver logistics, and condition/QA at the time of delivery are unknown. BetterRX has had exploratory conversations with DME-adjacent platforms, so they understand vendor economics and incentives, but not day-to-day operations. `[faq]`

**Vendor network.** BetterRX has **zero owned DME vendor relationships today.** Whatever we build must create value on day one, before a single vendor relationship exists. This is a cold-start problem as much as a coordination problem. `[brief]` `[faq]`

**Live inventory API.** Unlikely to exist in practice. But architect the ordering flow so a real-time inventory check can slot in later, with a graceful fallback to price/service-based selection. Forward-compatible design is explicitly called out as what the sponsor values most in judging. `[faq]`

**Delivery-timing data.** None exists in any shareable form. CMS DMEPOS public use files give utilization and payment by HCPCS code, back to 2013 — but they reflect **billing, not logistics**. There is no delivery-timing or fulfillment data anywhere. Any timeliness/reliability scoring rests on synthetic data or clearly labeled assumptions. `[faq]`

**Risk-scoring judgment.** AI ROI is judged on **approach and honesty about the baseline**, not on measured accuracy — there's no held-out dataset, so precision claims would be misleading. A well-reasoned model with labeled assumptions beats manufactured precision. `[faq]`

## Things we can safely treat as already built

- **eRx already receives admission / discharge / death events from the EMR today.** Existing infrastructure. A DME workflow can key off the same signals that already drive medication workflows. `[faq]`
- **Patient, diagnosis, and allergy data already flows into BetterRX's MedRx system** from the EMR. We can seed mock patients rather than building the integration. `[kickoff-qa]`
- The **ADT message** (admit/discharge/transfer) can be assumed received. Caveat: hospice runs backwards sometimes — the nurse gets a call to go do the admit and the paperwork lags the patient. Worth knowing, probably not worth coding for. `[kickoff-qa]`
- **No delivery timestamp history exists for DME.** BetterRX has some for medications where the pharmacy integration exists. DME delivery status is a **new capability to build**, not a feed to consume. `[faq]`

## Pickup trigger — a stated sponsor preference, not a guess

Nurse-initiated trigger **in the field at the time of death or discharge** is the **preferred primary path**. EMR status propagation is the **redundant fallback**. BetterRX has seen the EMR-only path fail in production: a discovery interview surfaced a case where a death didn't reach the DME vendor's system in time for pickup. Support both. `[faq]`

## Economics

The **hospice pays a per-patient-day (PPD) fee**, bundleable with the pharmacy tech PPD BetterRX already charges. Not the vendor, not a spread. This is settled — they've already debated it internally. `[faq]`

**Insurance is out of scope** — sponsor questionnaire: "we don't do anything with insurance unless it's Medicare or Medicaid." Nothing to build; at most a Medicaid mention in Q&A. `[team]` (relayed from questionnaire, 8/14 late call)

**5-to-10-second rule** — team design principle: every screen must be understandable in 5–10 seconds or it's bad design. `[team]`
