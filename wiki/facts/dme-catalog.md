# DME Catalog — what hospice patients actually use

`[team]` 2026-08-14. HCPCS E-codes from standard HCPCS Level II; spot-verify any code before it appears on a judged screen. 500+ codes exist `[brief]` — we seed the ~25 below, which cover the overwhelming majority of hospice orders. Plain-language name first, always (grandma rule).

## Bed & positioning (the admission core — serialized rentals)

| Plain name | HCPCS | Notes |
|---|---|---|
| Hospital bed (semi-electric) | E0260 | THE admission item; E0250 = fixed-height variant (in sponsor samples) |
| Pressure-relief mattress (foam overlay) | E0184 | Pressure-injury prevention |
| Alternating-pressure / low-air-loss mattress | E0277 | Higher acuity |
| Bed rails | E0310 | |
| Trapeze bar | E0910 | Repositioning |
| Overbed table | E0274 | |

## Respiratory (highest urgency; oxygen = hazmat path)

| Plain name | HCPCS | Notes |
|---|---|---|
| Oxygen concentrator | E1390 | Admission staple; electrical, no hazmat |
| Portable oxygen (gas cylinder) | E0431 | DOT hazmat — trained driver required ([[reverse-logistics-and-pickup]]) |
| CPAP | E0601 | In sponsor samples; most-fulfilled DME code nationally `[brief]` |
| BiPAP / RAD | E0470 | |
| Nebulizer | E0570 | |
| Suction machine | E0600 | Secretions, end-stage |

## Mobility

| Plain name | HCPCS | Notes |
|---|---|---|
| Standard wheelchair | E1130 | In sponsor samples |
| Transport chair | E1038 | |
| Wheelchair cushion | E2601 | |
| Walker | E0143 | Folding, wheeled |
| Cane | E0100 | |

## Transfer, bathroom, safety

| Plain name | HCPCS | Notes |
|---|---|---|
| Patient lift (Hoyer) + sling | E0630 | Two-person delivery/setup |
| Bedside commode | E0163 | Very common |
| Shower/bath chair | E0240–E0248 range | Verify exact code if displayed |
| Geri chair / clinical recliner | E0692 area — verify | Comfort positioning `[assumed]` |

## Consumables — the resupply-forecast targets (not serialized; delivered, not picked up)

- Oxygen tubing, cannulas, masks — replace on interval
- Wound care: dressings, tape, saline
- Incontinence: briefs, underpads (chux), gloves
- Catheter kits (foley), drainage bags
- Ostomy supplies
- Skin care / oral care kits
- Technically "medical supplies" not DME, but hospice provides them and resupply cadence lives here — deterministic interval + next-due date per ADR note in [[user-journeys]]; clinical-need driven, not payer-schedule driven ([[reverse-logistics-and-pickup]] research)

## Demo design implications

- Order flow groups by these categories with plain names; E-code shown small (integration credibility, not nurse-facing vocabulary).
- Serialized rentals (beds, concentrators, wheelchairs) get the full lifecycle incl. pickup + condition photo; consumables get delivery + resupply schedule, no pickup.
- Oxygen items carry the hazmat badge on the vendor stop card.
- **Oxygen tank resupply is a swap**: one stop = deliver full cylinders + retrieve empties. Model as a combined delivery+pickup stop card, not two events. `[team]`
- Admission bundle preset: bed + mattress + concentrator + commode + walker — one-tap "typical admission" order (guardrails-lite candidate).

Related: [[user-journeys]], [[reverse-logistics-and-pickup]], [order-lifecycle.md](order-lifecycle.md)
