# Vendor Scoring Variables

`[team]` 2026-08-14. The definitive list of what feeds the two vendor scores. Both are **deterministic, transparent formulas** over `order_events` — no ML ([[0004-reliability-score]]). Demo runs on synthetic history, labeled on-screen. Cold start = "Unrated," never zero.

## Score 1: Reliability (logistics — did it happen on time?)

| Variable | Event source | Notes |
|---|---|---|
| On-time delivery % | delivered_at vs promised window | The headline number |
| ETA accuracy | promised ETA vs actual | Chronically optimistic ETAs get caught even when "on time" |
| Confirmation responsiveness | time from order/nudge → confirm | Rewards vendors who answer the text |
| At-risk frequency | % of orders that ever entered At Risk | Even if recovered — near-misses count |
| Pickup timeliness | notification timestamp → picked_up_at | The post-death metric; 24h/48h thresholds `[assumed]` |
| Decline behavior | decline rate + how late declines arrive | Early honest declines ding less than late ones |

## Score 2: Condition (equipment quality — what showed up?)

Grounded in discovery: *"a wheelchair with a screw sticking out... a chair with fecal matter"* `[faq]`. Variables:

| Variable | Capture mechanism | Notes |
|---|---|---|
| Functional on arrival | Nurse one-tap ack at delivery | Does it work |
| State of repair | Same ack + driver POD photo | Maintained vs looks-a-century-old |
| Clean / sanitized | Same ack; sanitization is an accreditation requirement ([[reverse-logistics-and-pickup]]) | The visceral one |
| Post-delivery issue reports | Issue button on patient equipment card | Problems found after the door closes |
| Defect swap rate | % of orders needing replacement | The hard consequence of the above |

**Capture UX (grandma rule):** at delivery the nurse gets ONE tap — "Any problems with this equipment?" → *None / Dirty / Damaged / Not working*. Anything but None opens an optional photo. Driver's POD photo provides the vendor-side record of the same moment.

## Principles

- **Every variable is event-derived and visible to both sides** — the vendor report card shows the same numbers the hospice sees, with the formula printed. No black box (explainability is a rubric differentiator).
- **Fairness:** vendors can attach a note to any dinging event (dispute trail); declines-for-honest-reasons weigh less than silent failures; batched pickups within the window don't ding ([[vendor-value-prop]] — score is a flywheel, not a stick).
- **Weights are configurable per hospice** (guardrails philosophy) with sensible defaults; defaults labeled `[assumed]`.
- **Synthetic label** rides every score surface in the demo, with the accrual story: same formula fills with real events from day one.

Related: [[0004-reliability-score]], [[user-journeys]], [[views-storyboard]] (views 5, 12, 19)
