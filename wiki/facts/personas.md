# Personas

Sponsor gave these three hospice-side personas verbatim at kickoff. `[kickoff-qa]`

## Universal user assumption

High nurse turnover in hospice. Assume every user is new. Sponsor's instruction to his own team: *"think of your mom or your grandmother's least technical friend. That is your user."* Someone told to "refresh your page" may not know how. `[kickoff-qa]`

---

## 1. Admissions nurse — primary orderer

- Responsible for intake. When a patient comes onto hospice, she is most likely the one ordering the DME.
- The equipment is already prescribed at this point. She is simply ordering it. Oxygen tank, hospital bed.
- **Device: desktop** if she's at the office; field staff are on phone. `[kickoff-qa]`
- This is the discharge-readiness moment. Nothing goes home without the bed and the oxygen in place.

## 2. Case manager — ongoing orderer

- Visits the patient regularly, orders as the condition progresses. Didn't need a wheelchair at admission; now they do.
- Gets the prescription through an **IDT meeting** (interdisciplinary team: nurses meet with physicians, agree the patient is ready for a chair). The physician writes it; the **nurse** does the ordering in the platform.
- **Device: phone.** Field clinicians are on a phone, sometimes a tablet. Web app, not native, is fine — BetterRX is web-based today. `[kickoff-qa]`
- Also the person standing in the home at the moment of death. See the pickup trigger.

## 3. Director of Nursing (DON) — approver and reporter

- Sits over the admissions nurse and the field nursing staff.
- **Approves** high-cost orders / anything past a cost threshold.
- **Reads the reporting.** Owns the balance of care against cost.
- **Device: desktop.** The hospice "office" is typically a small box where the DON sits. `[kickoff-qa]`
- If we build approvals or reporting, this is who they're for.

## 4. DME vendor dispatcher — assume they never log in

- No vendor or dispatcher was interviewed and none is available to teams before or during the hackathon. Vendor-side operational reality is an **assumption we state**, not something the sponsor can validate. `[faq]`
- Design baseline: a vendor who **never logs into anything** and only ever responds to a confirmation email or text (SMS / magic-link style). A portal is a stretch goal, not a requirement. `[faq]`
- Bonus credit is available for either (a) a lightweight no-login vendor UX, or (b) a well-reasoned case that no vendor UI is needed at all because status is inferred from delivery/EMR events. Both are legitimate; "no UI" is not scored down. `[faq]`
- Judging weight sits **primarily on the hospice side**, because that's where the sponsor has real discovery data to evaluate against. `[faq]`

---

## Facts about how hospices actually operate

- Hospices **hold almost no inventory**. The office is a small box with a DON in it — not a hospital, not a nursing home. Even for drugs they keep only a small amount of OTC meds and comfort kits. A nurse can carry pain meds in her car; she cannot carry a bed. Everything is ordered. `[kickoff-qa]`
- **DME is far less regulated than prescriptions.** Nurses can hold a pre-authorization from a doctor that lets them order without a per-item prescription. Controlled substances are a completely different story. `[kickoff-qa]`
- Therefore the system **must support native order creation**, not just orders flowing through from the EMR. Sponsor confirmed this explicitly and emphatically. `[kickoff-qa]`
- DME pricing is **not regulated and not set by insurance or government** — it varies by vendor. Price is a real decision input at order time. `[kickoff-qa]`

## The three decision factors at the moment of ordering `[kickoff-qa]`

1. **On time** — is it in stock, when can it be delivered
2. **Price** — varies by vendor, currently invisible
3. **Selection** — today they're locked to a primary vendor and maybe a secondary; the delay problem follows from that lock-in

## Bedside nurse question (resolved 8/15 walkthrough)

Team asked whether we're missing a bedside-nurse persona. Checked the primary sources: the kickoff names only **field nurses (phone)** vs **admin nurse / DON (desktop)** [kickoff-qa], and the FAQ's preferred death trigger is "the nurse in the field at the time of death" [faq]. No third nurse type appears in sponsor material. Our admissions nurse and case manager ARE the field nurses; the two-tap deceased flow is the FAQ's preferred bedside trigger, built as specified. If a judge asks: the persona label differs by hospice, the capability is the bedside trigger, and we have it. [team]
