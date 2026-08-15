# Pitch Runbook — Saturday Aug 15, 2:50 PM slot

Deck: `docs/pitch/slideshow.html` — a SINGLE slide (James Wilson, today vs with-us contrast), fully offline. Press `r` to replay the reveal animation. It stays up for Vin's 90 seconds and returns for Q&A; everything else is the live app. Script: `wiki/facts/pitch-script.md`.

## T-45 min (~2:05 PM) — data reset

1. Supabase SQL editor → run `scripts/reset-demo.sql`.
2. Locally: `npm run seed && node scripts/seed-patch-conditions.mjs`.
3. Why: re-anchors every timestamp to now so Maria Santos's order (DME-10305) flags live on the Beat 5 clock advance instead of arriving pre-flagged. Skeptic-verified 8/15: if anyone advanced the demo clock earlier, the flag already fired and the on-stage advance shows nothing new. The reset clears that.

## T-35 min — stage the vendor demo (do not skip)

1. Vendor pages currently show no stops (seed gap). After the reset, Vin seeds vendor stop data (his open task) and verifies the run list renders for Ridgeline or Gulf Coast.
2. Pull one valid `/v/[token]` link from the DB AFTER the reset (tokens change on re-seed). Open it in a tab on the device Nathaniel presents from and leave it open.
3. Approvals staging is now optional (Ellen's money view is cut from the live demo). If you want it as a Q&A backup: place one >$500 order as Diego on Lucille Garcia or Henry Jackson. NEVER Frank Davis (localhost string leak) or Walter Kim (duplicate flags).


## T-30 min — phone setup checklist

- [ ] Phone on venue wifi AND cell data as fallback; test https://better-rx-dme.vercel.app loads on both.
- [ ] Screen mirroring to the projector tested once end-to-end. Know the input-switch gesture cold; that's the CUT TO PHONE moment.
- [ ] Sign in as **Diego Ramirez** (nurse) — this is the persona for Beats 4-6.
- [ ] Second browser tab (or second phone) signed in as **Ellen T.** (DON) for Beat 7, so the persona switch is a tab switch, not a sign-in flow on stage.
- [ ] Do Not Disturb ON. Auto-lock OFF (Settings → Display → Never). Brightness max.
- [ ] Tap into one patient TIMELINE during the walk (team-favorite view; show it in Beat 6 after the receipt)
- [ ] Walk the four demo paths once, in order, then STOP TOUCHING:
  1. Helen Price → order → 3 steps → compare card (don't place it; back out)
  2. /demo → note the clock-advance button location
  3. James Wilson's chart → timeline → find the death + pickup-requested events and the receipt (nothing to tap live)
  4. Ellen tab → Approvals shows the staged order → Reports → DME PPD + Days saved tabs

## T-15 min — laptop setup

- [ ] `slideshow.html` open fullscreen (F11 / ⌘⇧F). Press `r` once to confirm the reveal replays.
- [ ] Fallback assets on the desktop (see below), ready to open instantly.

## The 5:00 flow (three presenters)

| Clock | Who | Beat | Screen |
|---|---|---|---|
| 0:00 | Vin | James at 2:14 AM | THE slide |
| 0:35 | Vin | Sharing gap | THE slide |
| 1:05 | Vin | What we built, handoff | THE slide |
| 1:30 | Tony | Maria's flag + nudge + timeline | TONY'S PHONE (input switch) |
| 2:25 | Tony | James Wilson's record + receipt | PHONE |
| 3:10 | Nathaniel | Vendor run list, live | pre-opened /v/[token] tab |
| 3:45 | Nathaniel | AI justification | spoken (app still up) |
| 4:15 | Nathaniel | PPD, three levers | spoken |
| 4:40 | Nathaniel | Concessions + close | back to THE slide |

Timing checkpoints: Tony should open James Wilson's chart by 2:30; Nathaniel should be off the vendor tab by 3:50. Running long: cut the escalate-sheet sentence (Tony) and the GAO/DOJ material stays Q&A-only (Nathaniel).

AI wording guard (team decision, post-grill): the agent INTERPRETS replies and PROPOSES updates, human confirms below 0.75. Never say the live SMS loop runs; if asked, the parser runs on fixture replies behind a seam in this build.


## Failure fallbacks

**Wifi/app dies mid-demo:** the deck stands alone. Say "let me show you the same thing in stills," open the `docs/pitch/fallback/` screenshots folder (capture these at the ~1:30 venue rehearsal: compare card, /today with the amber flag + reason, escalate sheet, James Wilson's timeline + receipt, PPD report, days-saved tile). Narrate the same beats over stills; the script lines don't change.

**Screen-recorded demo video:** record one full pass at the 1:30 rehearsal (iPhone screen record, all four paths, ~90 seconds). Keep it on the laptop desktop as `demo-fallback.mov`. Worst case, play it muted and narrate.

**Clock advance doesn't flag Maria's order:** don't debug on stage. /today still shows other flagged orders with reasons (admission lead-time and pickup-window flags exist in seed); open one, read its reason, and say "this one flagged earlier the same way." The rule-with-a-reason story survives; only the liveness does not.

**Mirroring breaks:** demo on the phone held up + narrate from the slide 5 cast list, or fall back to the video. Do not spend stage seconds reconnecting.

**Approvals queue empty (staging step skipped):** Beat 7 still works: skip the approvals sentence, go straight to Reports → PPD + days-saved. The PPD answer is the load-bearing part.

## Q&A crib (also in slide 9's speaker notes)

- PPD: three ways down (price compare / billing clock / thresholds); mechanisms + labeled counters, never a percentage.
- Qualis: concede ordering + multi-vendor + 12 integrations; point at price-before-commit, predictive flags with reasons, timestamped receipt, protocol vs phone calls.
- Vendors participate because: a run list on their phone with nothing to install, a disputable score, and return trips cost them money.
- Replay-safe, precisely: duplicate deliveries with the same external event id are no-ops.
- AI cost: $0.004/order at Anthropic list pricing for the production design; demo parses via a flat-rate gateway at zero marginal cost; docs/AI-APPROACH.md states both.
- Never: "recent BetterRX news," Part B capped-rental rules, "nobody does this."
