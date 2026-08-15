# Event Schedule and Venues

Source: `https://luma.com/aibuilderday2?tk=jKRCw9` — **AI Builder Day**, presented by JustBuild and the Startup State Initiative. Hosts: Tyler Jennings, Jacob Wright. `[luma]`

## Venues

- **Friday:** Pelion Venture Partners, 14761 Future Way #500, Draper, UT 84020
- **Saturday: bill.com / DIBI building, Baker 915.** `[team]` Confirmed by Vin. The Luma page still lists Reference Club, 13707 S 200 W — that's stale, ignore it. R&R barbecue on site; kickoff said don't arrive early.

## Friday, August 14 — Learning day

Venue: **Pelion Venture Partners, 14761 Future Way #500, Draper, UT 84020**

| Time | |
|---|---|
| 8:00 AM | Doors, check-in, breakfast |
| 9:00 AM | Welcome and kickoff |
| 9:30 AM | Speaker sessions |
| 10:15 AM | Break |
| 10:30 AM | Tutorials |
| 12:00 PM | Lunch and sponsor expo |
| 12:30 PM | Featured speakers |
| **1:00 PM** | **Bounty presentations** — this is the BetterRX Q&A, captured in `wiki/transcripts/2026-08-14-betterrx-kickoff-qa.md` |
| 1:30 PM | Building begins |
| 5:00 PM | Building closes |

## Saturday, August 15 — Hackathon

Venue: **bill.com / DIBI building, Baker 915**

| Time | |
|---|---|
| 8:00 AM | Building opens |
| 10:00 AM | Workshops and learning sessions |
| **2:00 PM** | **Judging begins** ← the real deadline |
| 3:30 PM | Judges deliberate |
| 4:00 PM | Awards ceremony |
| 5:00 PM | Building closes |

## The number that matters

**Everything must be demo-ready by 2:00 PM Saturday.** Not 5:00 PM. Working backward from a 2:00 PM judging start with a 5-minute pitch plus Q&A:

- **~12:30 PM Sat** — feature freeze, start rehearsing the pitch
- **~11:00 AM Sat** — deliverables B–E written (AI rationale, differentiation snapshot, integration diagram, 2–3 scenarios)
- **Friday 5:00 PM** — building closes at the Friday venue; overnight work is on our own machines

## Other

- Prizes across the whole event: "$20K+ in prizes and hiring opportunities." The BetterRX bounty alone is $10,000.
- Eligibility: engineers, designers, founders, students (high school and university), business owners, "anyone curious." No experience required.
- Luma status showed **Event Full (waitlist)**. A prior note flagged that the page showed contradictory registration state on 2026-08-13; we attended Friday, so registration held.

## Presentation slot `[team]` (Luma, announced late 8/14)

- **We present at 2:50 PM Saturday.** Parallel tracks (GOED/MadeThis overlap us); a panel of judges per track, not the whole room. Rehearse to a 2:50 door, not 2:00.

## Saturday morning runbook (human / human+AI, non-coding) `[team]`

**9:30 AM team sync (30 min):**
- Review overnight agent output lane by lane against DoDs; anything that failed gets reassigned to Vin (agreed fallback). Move board cards to real statuses.
- Merge order: lanes → main via Vin's agent review; confirm Vercel deploy is green after each merge.

**Parallel until ~11:30 — deck + verification:**
- Build the pitch deck (V12): two family stories w/ generated portraits, 2:14 AM cold open, PPD answer slide, differentiation table ("no public evidence that…"), AI-honesty close, one integration diagram slide.
- **Re-verify CAHPS Q6 verbatim wording before that slide ships** (standing item).
- Human E2E pass of the three demo scenarios on real phones, incl. judge-QR magic link.

**Human-only ops (cannot be delegated to agents):**
- **Chase Tony + Nathaniel's sponsor Slack invites AND waivers** — prize money depends on signed waivers.
- Confirm Twilio number sends real SMS from the deployed app (Nathaniel); simulated-inbox fallback tested too.
- Ask in sponsor Slack EARLY (they're slow later): submission mechanics (repo link? deployed URL? deadline time?). Decide whether to ask the discharge-readiness question or keep our angle quiet.
- Watch the sponsor Slack for other teams' Q&A — public answers are free intel.
- Vin: sibling healthcare call feedback if it happened; fold anything real into Q&A prep.

**~11:30–12:30 first full rehearsal:** 5-minute timing, slide↔app swipe choreography, presenter DECIDED (still open), Q&A drill: PPD answer, "why SMS not GPS", the Qualis phone-call-vs-protocol reframe, GAO pre-empt, A2A slide line.
**Venue:** arrive per schedule (build day noon, Baker 915); re-rehearse once on venue wifi ~1:30; record a screen-capture fallback video of the demo in case wifi dies. **We present 2:50 PM.**
