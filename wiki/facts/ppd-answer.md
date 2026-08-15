# The PPD Question — sponsor told us it's coming

`[slack]` 2026-08-14 4:44 PM, Todd Blaquiere (sponsor POC), posted to all teams:

> "Our hospice buyer is looking for the answer to the question: how are you going to decrease my DME PPD (costs)? That could be a good question to prepare to answer in your presentation. ;)"

PPD = per-patient-day cost, THE hospice financial metric. This is as close to a rubric leak as we'll get — prepare a direct slide/answer.

## Our PPD-reduction answer (each lever maps to a built feature)

1. **Price at order time** ([[views-storyboard]] view 5): nurse sees per-vendor price before committing → cheaper vendor per order. Today price is invisible ([[competitor-products]] gap #2). Direct lever.
2. **The billing clock** ([[reverse-logistics-and-pickup]]): every equipment-day after death is PPD the hospice eats. Instant timestamped notification stops the meter at 2:14 AM, not Monday's batch list. The DON dashboard's **equipment-days-saved counter is literally PPD recovered** — demo shows the dollars.
3. **Guardrails** (sponsor's own playbook): cheaper-equivalent suggestions + DON approval thresholds encode the cost philosophy so a new nurse defaults cheap-but-right. BetterRX built guardrails on the pharmacy side *for exactly this metric*.
4. **Fewer failure premiums**: at-risk prevention avoids emergency re-orders, STAT upcharges, and duplicate deliveries `[assumed — no data, frame as mechanism not number]`.
5. **Resupply discipline**: interval-driven consumable reorders stop over-ordering.
6. **PPD visibility itself**: the DON cost-of-care view should present **DME PPD as its headline number** (DME spend ÷ census-days), right beside med PPD — you can't manage a number you can't see. BetterRX charges via PPD too (`[faq]`), so the buyer's metric and the product's pricing speak the same language.

## Slide shape

One line: *"Three ways down: pay less per order (price compare), pay for fewer days (the 2:14 AM billing clock), and default cheap-but-right (guardrails) — and the DON watches DME PPD live on one screen."*

Honesty note: we can demo mechanisms and synthetic dollar counters; we cannot claim a % reduction — no data exists. Say the mechanism, show the counter, label the assumption.

Related: [[pitch-plan]], [[user-journeys]] (DON dashboard), [problem.md](problem.md) (economics)
