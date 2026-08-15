# Judging, Deliverables, Logistics

## Rubric `[brief]`

| Weight | Criterion | What it tests |
|---|---|---|
| **30%** | Differentiation from current DME approaches | Did the team understand today's market well enough to **beat** it, not just match it? |
| **25%** | Addresses core user problems | Grounded in real pain points — discharge readiness, pickup timeliness, visibility — not an imagined problem |
| **15%** | Architecture and integration-readiness | Could this plausibly plug into BetterRX's eRx and an EMR without a rebuild? |
| **15%** | AI ROI | If AI is used, does it demonstrably beat a rules-based alternative, and is it used safely? |
| **15%** | UX and intuitiveness | Is the experience intuitive? |

**55% of the score is differentiation plus real-problem grounding.** Weight the build and the pitch accordingly.

## Five deliverables `[brief]`

None need to be polished. They need to be **true, specific, and real**.

- **A. A working application.** It must run. A clickable Figma flow or static demo won't cut it. Backend as simple as you like, but a judge clicks through a real interaction, not a mockup of one.
- **B. AI approach explanation, or rationale for skipping it.** What you used and how it compares to a rules-based baseline for your use case. Include a **rough estimate of token/compute cost per patient or per order**. Explain how you kept it safe: grounded, confidence-checked, human-confirmed for high-stakes actions. If you deliberately went rules-based somewhere, say why — that's a legitimate answer.
- **C. Differentiation snapshot.** Short and direct: what does this do differently from how DME ordering happens today, and why does that matter to a hospice or vendor?
- **D. Integration approach sketch.** How it connects to BetterRX's eRx and at least one EMR, including the data shape — what a patient or order record looks like moving between systems. **A diagram is enough.**
- **E. 2–3 example scenarios.** Discharge readiness, post-death pickup, service-failure prevention.

## AI bar — what scores and what doesn't `[brief]`

**Good reasons AI wins**
- **Pattern complexity** — the signal isn't a clean threshold. Predicting service-failure risk from vendor history, order type, geography, and timing has too many interacting variables for hand-tuned rules.
- **Data drift** — a rules engine needs constant manual retuning as vendor performance or volume shifts; a model adapts.
- **Novel inference** — surfaces a correlation nobody would hard-code, like one vendor's on-time rate degrading for a specific order type or region.

**What won't score well**
- An LLM call standing in for a lookup table or a simple if/then
- "We used AI" as the pitch, with no stated baseline
- AI that adds latency or fragility without adding accuracy, insight, or a capability rules genuinely couldn't offer

**Required defense at pitch time.** Two things: (1) why AI is right for *this* problem rather than a rules engine with extra steps, and (2) how it's kept safe — avoiding hallucinated statuses, capacities, or patient details; flagging low-confidence predictions instead of stating them as fact; requiring a person to confirm before a high-stakes action. **Teams that skip this defense get scored down under AI ROI regardless of model performance.**

**"Rules-based is better here" is a fine answer.** Teams that correctly identify where deterministic is the right call and say so will not be penalized. They're judging problem-solving judgment, not AI usage volume.

## Ground rules `[brief]`

| | |
|---|---|
| Eligibility | Open, no minimum experience |
| Team size | Any; 1–3 recommended |
| Max teams | 8 in the bounty room (kickoff logistics said **10 teams selected**) `[kickoff-logistics]` |
| Briefing | 15–20 min deep dive, Aug 14, 1:00 PM |
| Pitch | 5 min + Q&A, ~5 min buffer per team |
| Judges | 3, from BetterRX |

Loose eligibility is deliberate: it's a genuine discovery exercise, not a recruiting funnel. *"The naive-but-good idea is sometimes the one an experienced team filters out."*

## Winner terms and team read `[team]` (evening call 8/14)

- **Waiver**: winner hands off all code to BetterRX — it becomes their property in exchange for the $10,000. Vin signed; Tony and Nathaniel were not yet on the sponsor's email list (Slack invites + waivers pending — chase this before judging).
- Vin's read on how they'll judge: **the winner is whichever submission is most ready to be implemented now.** Optimize for "this could ship" over cleverness.
- Nathaniel's principle (via Claude): **built for the sponsor, not a generic judge** — it should feel like a fleshed-out product where the complications were thought through.
- Watch the naming: sponsor Slack is "BetterRxDME"; our team Slack is "Better Rx DME" (with spaces). Vin nearly cross-posted.

## Post-hackathon `[faq]`

BetterRX will review winning submissions for production quality and **intends to use the work, in part or in whole, as the foundation for a future DME product.** Real roadmap influence, not just an exercise.

## Logistics `[kickoff-logistics]` `[kickoff-qa]`

- Build day starts **noon** at the bill.com / DIBI building, Baker 915. Do not arrive early. R&R barbecue on site.
- **Sponsor contacts: Todd and Peter.** Also present at kickoff: Ben, Eric.
- Slack invite goes to the same email list that got the FAQ doc. BetterRX are Teams people, not Slack people, so expect friction.
- **All Slack answers are posted publicly to every team.** Anything we ask, everyone gets. Anything another team asks, we get. Watch the channel.
- Sponsors reachable all day, slower around dinner, **no responses after ~2:00 AM.** Get questions in early.
- Robot: $15 credits via QR, individual plans only. eCloud offering credits for custom/open-source model testing.
