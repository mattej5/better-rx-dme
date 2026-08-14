# ADR-0001: Take the BetterRX DME track

**Date:** 2026-08-14
**Status:** Accepted
**Decided by:** Vin

## Context

Three bounties were on offer at AI Builder Day: `[kickoff-logistics]`

| Bounty | Prize | Ask |
|---|---|---|
| **BetterRX** | $10,000 | Hospice DME ordering and visibility |
| GOED (government grant discovery) | $5,000 / $200 / $50 | Scrape federal grant APIs, match companies, auto-fill applications |
| MadeThis | $4,000 / $1,000 / shirt | Self-improving go-to-market/marketing agent |

Participants may enter **either** the BetterRX bounty or the general hackathon, not both. BetterRX capped at 10 selected teams so every team gets adequate presentation time.

## Decision

Take BetterRX.

## Reasoning

1. **Strongest existing fit.** Prior hospice/DME context means less cold-start on domain, which matters when 55% of the rubric is differentiation plus real-problem grounding.
2. **Real production upside.** BetterRX explicitly intends to use the winning submission, in part or whole, as the foundation for a future DME product. Not an exercise. `[faq]`
3. **Concrete data to build against.** The eRx integration already receives admission/discharge/death events, and the FAQ shipped real eRx JSON payloads. That's a real integration target, not an imagined one. `[faq]`
4. **Largest single prize** at $10,000, versus $5,000 and $4,000.
5. **Open lane.** Predictive analytics is established in hospice for clinical risk but almost unapplied to DME logistics, and the sponsor said out loud he hasn't seen good DME technology. `[landscape]` `[kickoff-qa]`

## Consequences

- MadeThis and GOED tasks on the Notion board are parked, not deleted.
- The one MadeThis requirement not already covered by the existing L4 build (an explicit Propose/Autopilot mode split) stays in Backlog.
- Team formed after the decision: Vin, **Tony Adair**, **Nathaniel**. Team size 1–3 is the recommendation, so we're at the cap.
