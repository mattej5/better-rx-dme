# Pitch Script, V12 beat sheet

`[team]` 2026-08-15. Slot: **2:50 PM**, 5 minutes + Q&A, 3 BetterRX judges, parallel track. Demo = iPhone screen mirroring on the projector. Prod: https://better-rx-dme.vercel.app. Reset step ~2:20 PM per [event-schedule.md](event-schedule.md).

Dead promises, do not say on stage: eval-harness demo, judge-sends-the-SMS, live vendor SMS loop, family comms, pickup rerouting. Vendor side is architecture + seams only.

Pacing: ~1000 spoken words of natural connected speech; at a conversational 160-170 wpm with demo taps overlapping narration this lands right at 5:00, but it has no slack. If the first rehearsal runs long, cut in this order: the supplier stat is already gone (slide-only now), Beat 8's JSON-contract sentence (keep for Q&A), Beat 4's synthetic-history sentence, Beat 1's second paragraph (the batch-list explanation repeats in Beat 6).

---

## Beat 1, Cold open: the 2:14 AM story (0:00-0:35)

**Screen: Slide 1** (dark, one line: "2:14 AM, Sunday")

> Robert Miller is 91 years old, and he's been on hospice care for Alzheimer's for the last six months. At 2:14 on a Sunday morning, he dies at home with his family around him and his nurse, Diego, at the bedside. Everything in that room, the hospital bed, the oxygen concentrator, the wheelchair, is rented from a DME vendor whose office doesn't open until Monday at nine.
>
> The way this works today, Robert's death goes onto a batch list that the vendor reads on Monday. His bed sits in the family's living room for days afterward, and the hospice pays rent on every single one of those days.
>
> In our app, Diego takes care of it before he leaves the house. The vendor is notified with a timestamp, and the billing clock stops at 2:14 in the morning instead of Monday at nine.

## Beat 2, The sharing gap (0:35-1:05)

**Screen: Slide 2** (the claim + the Brightree fact)

> Here's what surprised us in the research. Brightree, one of the biggest vendor-side platforms, already gives its dispatchers calculated ETAs, GPS, and driver photos of equipment condition, and we found no public evidence that any of it is ever surfaced to the hospice. So at least part of this problem is a sharing gap rather than a technology gap, and the hospice is left taking the blame for the two moments it controls least: late deliveries, and equipment that doesn't get picked up after a death.

## Beat 3, What we built (1:05-1:25)

**Screen: Slide 3** (one architecture line: EMR event → event log → nurse phone / vendor link)

> So we built that shared surface. Everything you're about to see enters through the exact endpoint HomeCare HomeBase would use, with the same envelope as a BetterRX medication event. And it's phone-first on purpose, because a case manager orders from a patient's living room, not from a desk. This is the live app, mirrored straight from my phone.

## Beat 4, LIVE: bedside order with price on screen (1:25-2:00)

**Screen: CUT TO PHONE** (interstitial slide, then mirroring). Path: patient → order → catalog → urgency → vendor compare.

> So now I'm Diego, the admissions nurse. Helen Price was just admitted with heart failure, and she needs a bed and oxygen in place before she gets home. Ordering takes three taps: what she needs, how urgent it is, and who should deliver it.
>
> This compare screen is the first cost lever. Diego sees each vendor's price per day and reliability score before he commits, and today that price is invisible until the invoice shows up. These are sample scores, the card says so right on it, and the same formula starts running on real events from day one.
>
> When I place the order, the vendor is notified automatically. Nobody at the hospice picks up a phone.

## Beat 5, LIVE: risk flagged before it's late (2:00-2:35)

**Screen: PHONE.** /demo clock advance → /today → DME-10305 (Maria Santos, suction machine) → escalate sheet.

> Now here's the part that no product we researched actually does. I'm going to advance the demo clock a few hours.
>
> Maria Santos's suction machine just went amber, and notice the delivery window hasn't elapsed yet. It tells you why in plain English: the vendor hasn't confirmed, and the time remaining is already inside their typical lead time for respiratory equipment. Five deterministic rules sit behind this, and every flag carries a reason a nurse can actually read.
>
> From that flag, Diego can wait, escalate to the director, or reorder from a backup vendor. A human makes that call every time. Nothing in this system reroutes itself.

## Beat 6, LIVE: the two-tap deceased flow (2:35-3:05)

**Screen: PHONE.** Robert Miller's patient page → status change → PATIENT IS DECEASED → confirm → receipt.

> Now let's go back to Robert Miller at 2:14 in the morning. Diego is standing at the bedside. From Robert's chart he opens the status change, taps patient is deceased, and confirms.
>
> This receipt is the whole point of the build. Under the standard hospice DME agreement, rental keeps billing until the hospice notifies the vendor. This timestamp is proof of notification down to the minute, captured at two in the morning without waking anyone up, and that's why it's printed so large. And the whole story, every event, sits timestamped on Robert's timeline.

## Beat 7, LIVE: what the director sees, and the PPD answer (3:05-3:40)

**Screen: PHONE.** DON persona (Ellen T.) → approvals queue (whatever pending orders exist post-reset; stage one if empty, see choreography) → reports: DME PPD + days-saved tile.

> Ellen, the Director of Nursing, gets the money view. Any order over the approval threshold waits here for her sign-off, and this report answers the question every hospice buyer asks, which is how are you going to decrease my DME cost per patient day.
>
> We bring it down three ways. You pay less per order because the price is visible at compare time. You pay for fewer days because of the billing clock you just watched stop. And new nurses default to the right choice because the approval thresholds encode the same guardrails BetterRX already built on the pharmacy side. This tile shows equipment-days avoided in dollars. The 26-hour baseline behind it is an assumption, labeled right on the screen, and we don't claim a percentage because no data exists anywhere to back one.

## Beat 8, The vendor side works too (3:40-4:05)

**Screen: Slide 4** (vendor SMS exchange mock + JSON contract line). Back to slides.

> The vendor gets their own working view: a run list of stops, where the dispatcher sets an ETA, marks delivered or picked up, and reports equipment condition. Every one of those taps lands on the same timeline the nurse is looking at. For vendors who live in text messages, there's an SMS path designed behind the same seam. To be straight with you, that live SMS loop isn't wired up in this build; the message ladder and reply parser behind it are built and tested. And because the seam is a JSON contract, a dispatcher taps a screen today and a vendor's AI agent can POST the same payload tomorrow.

## Beat 9, Differentiation, including what we concede (4:05-4:35)

**Screen: Slide 5** (capability table + concessions block)

> Let me start with what we concede. Qualis is real, it's hospice-specific, and it has twelve EMR integrations we don't have. Mobile ordering and multi-vendor selection are solved problems, so we don't claim them. And our death-triggered pickup gap is inferred from their public pages, not verified.
>
> Here's what we found no public evidence of anywhere: a price shown to the nurse before she orders, risk flagged before a window elapses, and a timestamped notification receipt. And where the incumbent answer to vendor silence is hiring people to make phone calls, we replace the phone call with a protocol, and the exhaust from that protocol becomes the vendor's reliability score.

## Beat 10, AI honesty, close (4:35-5:00)

**Screen: Slide 6** (the split: rules everywhere, LLM in one box, cost line)

> One last thing. The risk engine has no AI in it, and that's on purpose, because rules win when the inputs are two timestamps and a deadline. The language model lives in exactly one place, parsing messy free-text vendor replies, and at list pricing it costs about four tenths of a cent per order. The text message costs six times more than the model does.
>
> So that's the build. One endpoint in, one event log, and one timestamp that stops the billing clock. Happy to take questions.

---

## Q&A prep (not spoken unless asked)

- **PPD** (Todd telegraphed it): the Beat 7 answer, restated. Mechanisms + labeled counters, never a percentage.
- **"Qualis does this"**: concede mobile ordering and multi-vendor selection, point to price-at-order, predictive flags, receipt timestamp, protocol vs. managed-service. "Our weakest row is death-triggered pickup, and we said so first."
- **"Why would vendors participate?"** (Nathaniel's incentive frame, 8/15): near-zero friction (a run list on their phone, nothing to install), the reliability score is visible to them and disputable line by line, and the condition loop saves them money: a driver round trip to swap dirty equipment costs the vendor real dollars, so the score pays them to get it right the first time.
- **"Why SMS, not GPS?"**: location without route position is meaningless; SMS is how vendors already work; GPS refines after opt-in.
- **"What if the vendor has an AI agent?"**: Beat 8 line. Same JSON contract, human by SMS today, agent by POST tomorrow.
- **"Scores are fake"**: synthetic, labeled on every surface, computed not written, accrues from real events day one. No delivery-timing dataset exists in shareable form.
- **"AI ROI?"**: JAMIA Nov 2025, 7,764 reports: regex 89.2% vs LLM 87.7%, so hybrid, regex first, LLM only on the messy tail. Cost table in docs/AI-APPROACH.md. Below 0.75 confidence nothing changes state; reorder and escalate always need a human tap. If pressed on cost: $0.004/order is the production design at Anthropic list pricing; the demo itself parses through a flat-rate gateway at zero marginal cost, and the doc states both.
- **"Is it replay-safe?"** (if integration comes up): duplicate deliveries carrying the same external event id are no-ops (unique constraint + dedupe check); an event with no external id would append twice. Say it that precisely.
- **GAO pre-empt**: our claim is coordination fragility, not beneficiary-access harm.
- **Compliance kicker**: DOJ's 2026 takedown included billing for deceased patients; the timestamped death-to-notification chain doubles as an audit artifact.
- Do NOT cite recent BetterRX news (newsroom silent since Aug 2025). Do NOT use Part B capped-rental rules (don't apply to hospice DME).

## Demo choreography notes

- Cast, matches seed + persona roster: patient Robert Miller (deceased flow), Helen Price (bedside order), Maria Santos (DME-10305 at-risk), Nurse persona: Diego Ramirez (not Maria R., avoids collision with patient Maria Santos). DON: Ellen T.
- Persona cookie pre-set per beat; practice the switch to Ellen T. for Beat 7 (or keep a second browser tab signed in as DON).
- Skeptic-verified 8/15 ~11 AM against main + prod (11/14 claims VERIFIED at file level; report in session notes). Residual stage risks below.
- APPROVALS STAGING: the seed does NOT create pending approvals (skeptic confirmed; the Evelyn Brooks pair from the 8/14 commit message does not exist). After the pre-pitch reset, place one high-cost order (e.g. hospital bed + low-air-loss mattress, total > $500) as Diego so exactly one order sits in Ellen's queue for Beat 7. Current prod queue (5 Frank Davis STAT orders) is leftover interactive data and will vanish on reset.
- AVOID ON STAGE (demo-review 8/15): Frank Davis (localhost:3000 string leaks in his view) and Walter Kim (duplicate at-risk flags, zero-day pickup). Stage the approvals order on Lucille Garcia or Henry Jackson.
- CLOCK CHECK: before 2 PM confirm nobody advanced the prod demo clock; if DME-10305 already flagged, the Beat 5 advance shows nothing new. The reset re-anchors it.
- Rehearsal check: open Robert Miller's patient page on prod and confirm his equipment list roughly matches the cold-open line (bed, concentrator, wheelchair). His non-key orders come from randomized seed history; if it doesn't match, either adjust the spoken list or say "his bed, his oxygen, everything in that room."
- Beat 5 depends on the pre-pitch reset (~2:20 PM): `scripts/reset-demo.sql` in Supabase SQL editor, then `npm run seed && node scripts/seed-patch-conditions.mjs`, so DME-10305 flags on stage, not pre-flagged. Fallback if it misfires: pre-flagged orders still show on /today with reasons.
- Wifi-dead fallback: screen-recorded demo video + screenshots folder (runbook, Phase 2).
