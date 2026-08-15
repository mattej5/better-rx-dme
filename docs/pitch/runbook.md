# Pitch Runbook — Saturday Aug 15, 2:50 PM slot

Deck: `docs/pitch/slideshow.html` (open directly in a browser, fully offline, no wifi needed). Keys: arrows or click to advance, `n` toggles speaker notes, Home/End jump. Script: `wiki/facts/pitch-script.md`.

## T-45 min (~2:05 PM) — data reset

1. Supabase SQL editor → run `scripts/reset-demo.sql`.
2. Locally: `npm run seed && node scripts/seed-patch-conditions.mjs`.
3. Why: re-anchors every timestamp to now so Maria Santos's order (DME-10305) flags live on the Beat 5 clock advance instead of arriving pre-flagged. Skeptic-verified 8/15: if anyone advanced the demo clock earlier, the flag already fired and the on-stage advance shows nothing new. The reset clears that.

## T-35 min — stage the approvals order (do not skip)

The seed does NOT create pending approvals; after reset, Ellen's queue is empty and Beat 7 shows a blank screen. Fix:

1. On the phone, signed in as Diego Ramirez (nurse), open any active patient EXCEPT Helen Price (she's the live Beat 4 order; suggest Lucille Garcia or Henry Jackson).
2. Place one order totaling over $500 (hospital bed E0260 + low-air-loss mattress E0277 clears it easily), any urgency.
3. Confirm it appears under Approvals when signed in as Ellen T. Leave it pending.

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
  3. Robert Miller's chart → note the Status change button (don't tap it)
  4. Ellen tab → Approvals shows the staged order → Reports → DME PPD + Days saved tabs

## T-15 min — laptop setup

- [ ] `slideshow.html` open in a fullscreen browser window (F11 / ⌘⇧F). Test arrows.
- [ ] Speaker notes rehearsed, then `n` OFF for the projector.
- [ ] Fallback assets on the desktop (see below), ready to open instantly.

## The 5:00 flow

| Clock | Beat | Screen | Cue |
|---|---|---|---|
| 0:00 | 1 · Robert, 2:14 AM | Slide 2 | Portrait up while you tell it |
| 0:35 | 2 · Sharing gap | Slide 3 | 37% counter animates on entry |
| 1:05 | 3 · What we built | Slide 4 | Architecture line |
| 1:25 | 4-7 · LIVE | Slide 5 then SWITCH INPUT | Slide 5 is the CUT TO PHONE cue card; audience sees the cast while you switch |
| 1:25 | 4 · Helen's order | PHONE | 3 steps, stop on compare card, place order |
| 2:00 | 5 · Maria's flag | PHONE | /demo advance → /today → open flag → escalate sheet |
| 2:35 | 6 · Robert's receipt | PHONE | Chart → status change → deceased → confirm → receipt |
| 3:05 | 7 · Ellen's money view | PHONE (Ellen tab) | Approvals → Reports → PPD answer |
| 3:40 | 8 · Vendor protocol | BACK TO SLIDES (6) | Say the SMS-not-wired line before a judge asks |
| 4:05 | 9 · Differentiation | Slide 7 | Concessions box first, table second |
| 4:35 | 10 · AI + close | Slides 8-9 | Counters animate; land on Robert |

Timing checkpoints: if you're past 2:10 when Maria's flag opens, or past 3:15 when Ellen's tab opens, cut per the script header (Beat 8's JSON-contract sentence first, then Beat 4's sample-scores sentence).

## Failure fallbacks

**Wifi/app dies mid-demo:** the deck stands alone. Say "let me show you the same thing in stills," open the `docs/pitch/fallback/` screenshots folder (capture these at the ~1:30 venue rehearsal: compare card, /today with the amber flag + reason, escalate sheet, deceased receipt, approvals, PPD report, days-saved tile). Narrate the same beats over stills; the script lines don't change.

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
