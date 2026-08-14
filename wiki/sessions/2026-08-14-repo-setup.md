# 2026-08-14 — Repo setup and knowledge capture

**Who:** Vin (+ Claude)
**Goal:** Stand up the repo with every resource we've been given, so all three of us and our agents work from the same context.

## Done

- `git init` in `/Users/vinjones/Projects/better-rx-dme`. **No remote configured yet.**
- Extracted and committed all sponsor material into `docs/bounty/`:
  - Bounty brief, market landscape, sample orders (from the Hackathon Bounty Files zip — the HTML is tab-based, so plain text extraction missed most of it; re-extracted with a tag stripper to recover all nine tabs)
  - Bounty Team FAQ (docx)
  - Originals preserved untouched in `docs/bounty/original/`
- Pulled today's Wispr Flow transcripts. The **BetterRX kickoff Q&A** (1:29–1:54 PM) is the highest-signal source we have and is captured verbatim in `wiki/transcripts/`. It contains material that appears nowhere in the written brief.
- Built the wiki: seven fact files, one ADR, three transcript files, this index.
- Wrote `CLAUDE.md` so any agent picks up the constraints, personas, rubric, and capture rules without re-reading everything.

## Highest-value things learned today that were NOT in the written brief

All from the kickoff Q&A:

1. **Native order creation is required**, not just EMR flow-through. Asked directly, answered "Yes, absolutely."
2. **DME is barely regulated compared to prescriptions.** Nurses hold open pre-auth; no per-item prescription needed. This removes a whole workflow we might otherwise have built.
3. **DME pricing is unregulated and vendor-specific**, so price is a live decision input at order time.
4. The sponsor's own framing is **Amazon**: in stock, ETA, price, selection — against today's single-vendor lock-in.
5. **Guardrails / "philosophy of care"** is an existing BetterRX pharmacy feature with no DME equivalent. Building it for DME speaks their language directly.
6. **Hospices hold essentially no inventory.** The office is "a little box where a director of nursing sits."
7. **The hospice pays for the equipment every day it sits** in the home after a death.
8. Sponsor, unprompted: *"I've gotten to see DME technology. I haven't seen anything great."*

## Open

- GitHub remote — Vin referenced a repo, no URL landed. Local git only.
- Nathaniel's last name for the roster.
- See `wiki/facts/open-questions.md` for the sponsor-facing list.

## Next

Design the DME order/event schema against the real eRx payloads in `wiki/facts/integration-and-data.md`, and decide the vendor-side approach (no-login SMS/magic-link vs. no-vendor-UI case). Both are P0 on the Notion board.
