# The Problem

## One sentence

Hospices are blamed for two moments they don't control: equipment arriving late for a discharge, and equipment sitting in a grieving family's home after a death. Both are executed by an outside DME vendor, outside the hospice's EMR. `[brief]`

## Why it lands on the hospice

Families and regulators don't distinguish the hospice from the vendor. Service failures hit the hospice's reputation and its CAHPS scores, which is the survey data families use to pick a hospice. `[brief]` `[kickoff-qa]`

The same dynamic already exists on the pharmacy side: if the pharmacy is late, the hospice takes the hit, because nobody knows the pharmacy. BetterRX has lived this. `[kickoff-qa]`

## Discovery quotes (7 hospice execs interviewed; no vendor-side interviews) `[faq]`

**Late delivery blocks discharge**
- "In ten percent of cases she will authorize the equipment to be there a day before the discharge home, as there is no guarantee from the DME company. Big service failure issue for hospice." — Hospice CEO
- "DME is the bigger headache because of the lack of options. DME is more about the logistics. Nationals only work Monday through Friday, nine to five." — Hospice CEO

**Post-death pickup**
- "It's very distressing to see the equipment of a loved one still lingering in your home. The pickup process gives the hospice a bad name." — Hospice CEO
- "Someone would die and StateServ wouldn't know about it. If we don't pick it up then we have to pay for an additional day as well." — Hospice COO
- "The DME doesn't consider themselves part of our org. But it reflects on our org. We want perfection." — Hospice COO

**Fragmented visibility**
- "Three levels: one, SSO. Two, single pane of glass. Three, one place to do it all. I haven't heard of anyone doing this yet." — Hospice VP Digital Transformation
- "We can see real time updates on if equipment has been ordered, left the warehouse, in route." — Hospice Admin/CEO

**Equipment condition**
- "We had a wheelchair with a screw sticking out of it. Or a chair with fecal matter. People in hospice don't realize that this is a separate company." — Hospice CEO

## Economics that make it bite

- The hospice **pays for the equipment for every day it sits in the home** after the patient dies. Slow pickup is a direct cost, not just a reputation cost. `[kickoff-qa]`
- Hospice is a very cost-constrained industry operating on thinning margins with no government relief. Cost visibility at the moment of ordering is therefore a real lever. `[kickoff-qa]`
- DME claim denial rates run **15–25%**, versus 5–10% for general medical billing, mostly from documentation gaps rather than coverage disputes. `[landscape]`

## What BetterRX thinks wins

Sponsor's own framing, spoken at kickoff: the battle is won on **visibility** (where is it, is it in stock, when will it arrive, what does it cost) and **selection** (today hospices are locked into one primary vendor, maybe a secondary). The mental model he used out loud was **Amazon**: same product, this one gets there faster, and you can see the price. `[kickoff-qa]`

Two years ago BetterRX was the first in its industry to put real drug prices in the ordering system. Doctors told them they'd never known what meds cost. He explicitly wants the DME equivalent. `[kickoff-qa]`

## Guardrails: the sponsor's own product philosophy

BetterRX's existing pharmacy product has a feature they call **guardrails** — operational leaders encode the hospice's "philosophy of care" so a new, non-technical nurse defaults to the right choice in the moment (e.g. auto-substituting a therapeutically equivalent, cheaper med). Nurse turnover is high, so every user is effectively a first-time user. Building the DME equivalent of guardrails is directly aligned with how this sponsor thinks. `[kickoff-qa]`

## What winning looks like `[brief]`

Make a hospice case manager's or a DME dispatcher's day measurably easier. That matters more than technical polish.
