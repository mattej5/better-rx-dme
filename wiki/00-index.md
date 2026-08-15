# Wiki Index — BetterRX DME Bounty

Second brain for this build. Start here. Every note carries a source tag: `[brief]` `[faq]` `[kickoff-qa]` `[landscape]` `[team]` `[assumed]` `[research]` (= verified by us against a cited external source).

## Facts

- [problem.md](facts/problem.md) — what's actually broken, in the hospices' own words
- [user-journeys.md](facts/user-journeys.md) — per-persona journeys + the dashboard artifacts each persona cares about
- [vendor-value-prop.md](facts/vendor-value-prop.md) — how we win the vendor who never logs in (Redo + Plaibook patterns)
- [pitch-plan.md](facts/pitch-plan.md) — 5-min narrative arc + the four above-and-beyond proof artifacts
- [competitor-products.md](facts/competitor-products.md) — **read before claiming any differentiator**; Qualis kills two of our old angles
- [reverse-logistics-and-pickup.md](facts/reverse-logistics-and-pickup.md) — billing-stop clause, pickup economics, sanitization, oxygen hazmat
- [why-deliveries-fail.md](facts/why-deliveries-fail.md) — causal chain, CAHPS truth (no equipment item; Q6 is the anchor), SMS precedents, rules-vs-LLM evidence
- [dme-catalog.md](facts/dme-catalog.md) — the ~25 items to seed, by category, with E-codes + hazmat/serialized flags
- [views-storyboard.md](facts/views-storyboard.md) — all 22 screens incl. the boring ones; input for Claude Design
- [user-scenarios.md](facts/user-scenarios.md) — Tony's concrete scenario walkthroughs (ordering, at-risk, pickup)
- [vendor-scoring.md](facts/vendor-scoring.md) — the definitive variable list for both vendor scores + capture UX
- [last-30-days-2026-08.md](facts/last-30-days-2026-08.md) — window sweep: CMS FY2027 rule, DMEPOS moratorium (careful framing), A2A verdict, Kitesurf/agent-readiness, BetterRX newsroom silent
- [ppd-answer.md](facts/ppd-answer.md) — **Todd told us the buyer question: "how do you decrease my DME PPD?" Prepared answer inside**
- [personas.md](facts/personas.md) — admissions nurse, case manager, DON, vendor dispatcher
- [constraints-and-assumptions.md](facts/constraints-and-assumptions.md) — hard rules, and what we're assuming with no data
- [integration-and-data.md](facts/integration-and-data.md) — eRx event payloads, EMRs, HCPCS codes, public datasets
- [order-lifecycle.md](facts/order-lifecycle.md) — the six states and the sample order shapes
- [competitive-landscape.md](facts/competitive-landscape.md) — how DME moves today, where the gaps are
- [judging.md](facts/judging.md) — rubric, deliverables, logistics
- [event-schedule.md](facts/event-schedule.md) — **judging starts 2:00 PM Saturday**; venue conflict flagged
- [glossary.md](facts/glossary.md) — DME, CAHPS, IDT, ADT, DON, PPD, HCPCS
- [open-questions.md](facts/open-questions.md) — unanswered; ask in Slack, don't guess

## Skills

- `.claude/skills/betterrx-design/` — **invoke `betterrx-design` before building any UI.** Real BetterRX tokens measured from betterrx.com and their own bounty brief. Ships `tokens.css` ready to import.

## Decisions

- [0001-track-betterrx.md](decisions/0001-track-betterrx.md) — why BetterRX over GOED and MadeThis
- [0002-demo-spine.md](decisions/0002-demo-spine.md) — hospice-first; vendor = magic-link only, no org model
- [0003-ai-scope.md](decisions/0003-ai-scope.md) — rules where rules win; LLM only for messy free text; GPS via magic link
- [0004-reliability-score.md](decisions/0004-reliability-score.md) — synthetic, labeled loud, flywheel not stick
- [0005-stack.md](decisions/0005-stack.md) — web-only, Supabase, Vercel, BetterRX identity, 3-way split

## Transcripts

- [2026-08-14 BetterRX kickoff Q&A](transcripts/2026-08-14-betterrx-kickoff-qa.md) — the highest-signal source in this repo
- [2026-08-14 Hackathon kickoff logistics](transcripts/2026-08-14-hackathon-kickoff-logistics.md)
- [2026-08-14 Other Builder Day talks](transcripts/2026-08-14-other-talks.md) — adjacent, not DME

## Sessions

`sessions/` — end-of-session summaries, newest first. Append when substantial work lands.

- [2026-08-14 evening team call](sessions/2026-08-14-evening-team-call.md) — SMS decision, replacement flow, pickup no-reroute rule, demo plan, waiver terms

## External

- **Claude Design canvas (FINISHED — visual source of truth for all screens)**: project "BetterRX DME P0 Screens" — share link in team Slack (published web artifact). Frames: 1a/1b/1c P0 spine · 2a–2e DON/pickup/readiness/vendor · 3a/3c/3d role switcher, guardrails, BUILD HANDOFF table (screens → routes → components + spec deltas). Build agents: consult the 3d handoff frame before implementing any screen; spec deltas 1–7 are reconciled in `specs/frontend.md` §5b.
- Kanban: Notion "Build Tasks" under *AI Builder Day — Hackathon Tracker*
- Sponsor contact: Slack channel from BetterRX (Todd and Peter, primary POCs). Answers get posted publicly to all teams.
