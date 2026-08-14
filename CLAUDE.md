# CLAUDE.md — BetterRX DME Bounty

Project instructions for any AI agent working in this repo. Read this file, then read `wiki/00-index.md` before doing anything else.

## What this is

A 24-hour hackathon build for the **BetterRX Builder Day Bounty: DME Ordering and Visibility Challenge** ($10,000, Aug 14–15 2026). We are closing the coordination gap between hospices and durable medical equipment (DME) vendors, from admission through post-death pickup.

Team: **Vin Jones**, **Tony Adair**, **Nathaniel**.

Source of truth for the problem lives in two places:
- `docs/bounty/` — verbatim sponsor material (brief, FAQ, market landscape, sample orders). Never edit these. They are the sponsor's words.
- `wiki/` — our distilled second brain: facts, decisions, personas, transcripts, session logs. This is where new knowledge goes.

## The one-line problem

Hospices get blamed for two moments they don't control: equipment arriving late for a discharge, and equipment not being picked up after a patient dies. Both are handled by an outside DME vendor, outside the hospice's EMR.

## Hard constraints (do not violate)

1. **Synthetic data only.** No real patient data, no real hospice client data, nothing proprietary to any employer or prior project. Generate synthetically or ground in CMS public use files.
2. **It must actually run.** A clickable mockup or Figma flow does not count. A judge clicks through a real interaction.
3. **AI must be defended.** If any AI/ML is used, name the deterministic baseline it beats and say why. "We used AI" with no stated baseline scores badly. Choosing rules-based and saying so is a legitimate, unpenalized answer.
4. **Vendor network building is out of scope.** Treat vendor participation as given. Baseline vendor = someone who never logs in and only replies to an SMS or magic link.
5. **State assumptions out loud.** There is no defined DME delivery-window standard, no vendor-side operational data, and no delivery-timing dataset. Label assumptions as assumptions in both the demo and the writeup.

## Judging rubric (weight the work accordingly)

| Weight | Criterion |
|---|---|
| 30% | Differentiation from current DME approaches |
| 25% | Addresses core user problems (discharge readiness, pickup timeliness, visibility) |
| 15% | Architecture and integration-readiness |
| 15% | AI ROI (beats a rules baseline, used safely) |
| 15% | UX and intuitiveness |

Differentiation is the single largest bucket. Before adding a feature, ask what it does that phone/fax/vendor-portal ordering does not.

## Users you are building for

Assume the user is non-technical and brand new. High nurse turnover means every user is effectively a first-time user. Sponsor's phrasing: think of your grandmother's least technical friend.

- **Admissions nurse** — orders DME at intake. Phone (mobile web).
- **Case manager** — orders as the condition progresses; gets the prescription via an IDT meeting. Phone.
- **Director of Nursing (DON)** — approves high-cost orders, reads reporting. Desktop.
- **DME vendor dispatcher** — may never log in. Assume SMS or magic link.

Full detail: `wiki/facts/personas.md`.

## Design

**Invoke the `betterrx-design` skill before building or restyling any UI.** It carries BetterRX's real brand tokens — measured from betterrx.com and from the bounty brief they authored, not invented — plus a ready-to-import `tokens.css`. UX is 15% of the rubric and showing the sponsor their own design language back is close to free points.

Fast version: Poppins for headings, Inter for body. Salmon `#EF7869` brand, slate ink `#24333F`, warm paper `#FBFAF8` (never pure white). Buttons are `3px` radius, weight 800, uppercase. **Never set body text in salmon** — it's ~2.8:1 on white and fails AA. Build the phone layout first; the case manager orders from a patient's home.

## Timing

**Judging starts 2:00 PM Saturday, Aug 15.** That's the deadline, not 5:00 PM. See `wiki/facts/event-schedule.md` — it also flags an unresolved conflict between the Luma page and the kickoff briefing on Saturday's start time and venue.

## Working agreements for agents

- **Capture everything.** Any new fact learned from a sponsor answer, a Slack reply, a teammate, or your own research goes into `wiki/facts/` as a short note with a source and a date. Non-obvious decisions go into `wiki/decisions/` as a numbered ADR. End-of-session summaries go into `wiki/sessions/`.
- **Cite the source.** Every claim in the wiki gets a source tag: `[brief]`, `[faq]`, `[kickoff-qa]`, `[landscape]`, `[team]`, or `[assumed]`. `[assumed]` is honorable; unlabeled guessing is not.
- **Never invent sponsor answers.** If the brief, FAQ, and kickoff transcript don't cover it, write it in `wiki/facts/open-questions.md` and flag it for the Slack channel. Do not fill the gap with a plausible-sounding fact.
- **Task board is Notion**, not this repo: "Build Tasks" under *AI Builder Day — Hackathon Tracker*. Columns: Backlog / Ready / In Progress / Blocked / Done. Every task carries a Definition of Done before it moves to Ready.
- **Prefer editing existing files** over creating new ones. Keep the wiki flat and short; a fact note is a paragraph, not an essay.
- Do not add code comments unless the logic isn't self-evident. Don't over-engineer, it's a 24-hour build.

## Deliverables checklist (what judging expects)

- [ ] A. A working application that actually runs
- [ ] B. AI approach explanation vs. a rules-based baseline, including rough token/compute cost per order, and how it's kept safe (grounded, confidence-flagged, human-confirmed for high-stakes actions)
- [ ] C. Differentiation snapshot vs. how DME ordering works today
- [ ] D. Integration approach sketch: BetterRX eRx + at least one EMR (HCHB, Axxess, WellSky, MatrixCare), including the record shape. A diagram is enough.
- [ ] E. 2–3 example scenarios: discharge readiness, post-death pickup, service-failure prevention

Pitch is 5 minutes plus Q&A. Three BetterRX judges.

## Repo layout

```
docs/bounty/      verbatim sponsor material — read-only
  original/       untouched .html / .docx as delivered
wiki/             our second brain
  00-index.md     start here
  facts/          distilled knowledge, one topic per file
  decisions/      numbered ADRs
  transcripts/    Wispr Flow transcripts, lightly cleaned
  sessions/       end-of-session summaries, newest first
```
