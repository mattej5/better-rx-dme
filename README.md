# better-rx-dme

BetterRX Builder Day Bounty — **DME Ordering and Visibility Challenge**. $10,000. Aug 14–15, 2026.

Closing the coordination gap between hospices and durable medical equipment vendors, from admission through post-death pickup.

**Team:** Vin Jones · Tony Adair · Nathaniel

## Start here

| If you are | Read |
|---|---|
| An AI agent working in this repo | [CLAUDE.md](CLAUDE.md), then [wiki/00-index.md](wiki/00-index.md) |
| A human joining the team | [wiki/facts/problem.md](wiki/facts/problem.md), then [wiki/transcripts/2026-08-14-betterrx-kickoff-qa.md](wiki/transcripts/2026-08-14-betterrx-kickoff-qa.md) |
| Looking for the sponsor's exact words | [docs/bounty/](docs/bounty/) |

## The problem in one sentence

Hospices get blamed for two moments they don't control: equipment arriving late for a discharge, and equipment still sitting in a grieving family's home after a death. Both are executed by an outside DME vendor, outside the hospice's EMR.

## Layout

```
CLAUDE.md         agent instructions — read first
docs/bounty/      verbatim sponsor material, read-only
  original/       untouched .html / .docx as delivered
wiki/             our second brain
  00-index.md     index of everything below
  facts/          distilled knowledge, one topic per file
  decisions/      numbered ADRs
  transcripts/    Wispr Flow transcripts
  sessions/       end-of-session summaries, newest first
```

Task board lives in Notion: **Build Tasks**, under *AI Builder Day — Hackathon Tracker*.

## Non-negotiables

- Synthetic data only. No real patient or hospice data, ever.
- The app has to actually run. A mockup does not count.
- Any AI must be defended against a named rules-based baseline.
- Every assumption gets stated out loud, in the demo and the writeup.
