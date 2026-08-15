# Pitch Script, V12 v5: three presenters

`[team]` 2026-08-15, post-grill restructure per Nathaniel's outline. Slot: **2:50 PM**, 5 minutes + Q&A. ONE slide only (James Wilson before/after contrast); everything else is live demo. iPhone mirroring; vendor view via pre-opened token link. Prod: https://better-rx-dme.vercel.app.

Presenters: **Vin** (story + pain points, 0:00-1:30) → **Tony** (nurse demo, 1:30-3:10) → **Nathaniel** (vendor view + AI + PPD + close, 3:10-5:00).

Do not say on stage: magic link / no-login boasts, "the live SMS loop runs," eval-harness demo, family comms, pickup rerouting, "nobody does this." AI wording is the softened middle-man: the agent INTERPRETS replies and PROPOSES updates; a human confirms below confidence; do not claim the live loop is wired.

Never demo: Frank Davis (localhost string leak), Walter Kim (duplicate flags). James Wilson's DME-09803 is a ValueCare order; his timeline includes a dirty-condition report, fine to scroll past.

---

## VIN · Beat 1, James at 2:14 AM (0:00-0:35) — THE slide

> James Wilson is 93 years old, and he's been on hospice care with multiple myeloma for the last five months. At 2:14 on a Sunday morning, he dies at home with his family around him and his nurse, Diego, at the bedside. Everything in that room, the hospital bed, the oxygen concentrator, the wheelchair, is rented from a DME vendor whose office doesn't open until Monday at nine.
>
> The way this works today, James's death goes onto a batch list that the vendor reads on Monday. His bed sits in the family's living room for days afterward, and the hospice pays rent on every single one of those days. And when the family calls to ask why the bed is still there, they call the hospice, because the hospice is the only number they have.

## VIN · Beat 2, The sharing gap (0:35-1:05) — THE slide (still up)

> Here's what surprised us in the research. Brightree, one of the biggest vendor-side platforms, already gives its dispatchers calculated ETAs, GPS, and driver photos of equipment condition, and we found no public evidence that any of it is ever surfaced to the hospice. So at least part of this problem is a sharing gap rather than a technology gap, and the hospice is left taking the blame for the two moments it controls least: late deliveries, and equipment that doesn't get picked up after a death.

## VIN · Beat 3, What we built, handoff (1:05-1:30) — THE slide (still up)

> So we built the shared surface that's missing. Every order lives as an append-only event log, entering through the exact endpoint HomeCare HomeBase would use, with the same envelope as a BetterRX medication event. It's phone-first on purpose, because nurses order from a patient's living room, not from a desk. Tony's going to show you, live, on his phone.

## TONY · Beat 4, Maria's flag, the nudge, the timeline (1:30-2:25) — CUT TO PHONE

**Path:** /demo clock advance → /today → DME-10305 (Maria Santos) → order timeline → Nudge again → escalate sheet.

> This is the live app, mirrored from my phone. I'm Diego, the nurse on today. I'm going to advance the demo clock a few hours, the way an afternoon slips away on a real shift.
>
> Maria Santos's suction machine just went amber, and notice the delivery window hasn't elapsed yet. It tells you why in plain English: the vendor hasn't confirmed, and the time remaining is already inside their typical lead time for respiratory equipment. Five deterministic rules sit behind this, and every flag carries a reason a nurse can actually read.
>
> From here I can nudge the vendor with one tap, and the nudge lands right on the order's timeline, timestamped, next to every other event in this order's life. That timeline is the documentation a nurse never has to write. And if nudging isn't enough, I can escalate to the director or reorder from a backup vendor. A human makes that call every time.

## TONY · Beat 5, James's record (2:25-3:10) — PHONE

**Path:** James Wilson's patient page → timeline → death event → pickup requested → receipt.

> Now back to James Wilson from Vin's story. James is a real record in this system. Here's his timeline: the nurse recorded his passing at the bedside, two taps, and the vendor was notified two minutes later. Not Monday's batch list. Two minutes, timestamped.
>
> That receipt is the whole point of the build. Under the standard hospice DME agreement, rental keeps billing until the hospice notifies the vendor, so this timestamp is the moment the billing clock stops, captured in the middle of the night without waking anyone up. And the whole story, every event, sits on James's timeline. Nathaniel will show you what the other side of that notification looks like.

## NATHANIEL · Beat 6, The vendor view, live (3:10-3:45) — vendor tab, live

**Path:** pre-opened /v/[token] tab → run list → a stop → set ETA → mark delivered → condition report.

> Here's what the vendor sees, live. No portal training, just their run list: every stop, every item, every deadline. The dispatcher taps a stop, sets an ETA, marks it delivered or picked up, and reports the equipment's condition. Every one of those taps lands on the same timeline Tony just showed you. The hospice and the vendor are finally looking at the same facts.

## NATHANIEL · Beat 7, The AI justification (3:45-4:15) — spoken over the live app or the slide

> Now, where's the AI, and why. The risk engine you watched has no AI in it, on purpose, because rules win when the inputs are two timestamps and a deadline. The AI sits in the middle of the hospice-vendor conversation: real dispatchers answer in messy free text, and our agent interprets those replies and proposes the status update, so the nurse gets a live status without making a phone call. Below 0.75 confidence it proposes and a human confirms; it never cancels or reorders on its own. At list pricing it costs about four tenths of a cent per order, and the text message itself costs six times more than the model does.

## NATHANIEL · Beat 8, The PPD answer (4:15-4:40) — spoken

> And here's the answer to the question every hospice buyer asks: how do you decrease my DME cost per patient day. Three ways down. You pay less per order, because the price per day is visible before the nurse commits. You pay for fewer days, because of the billing clock Tony stopped at 2:14 in the morning. And new nurses default to the right choice, because approval thresholds encode the same guardrails BetterRX already built on the pharmacy side. We don't claim a percentage, because no data exists anywhere to back one, and we'd rather show you the mechanism than invent a number.

## NATHANIEL · Beat 9, Concessions + close (4:40-5:00) — spoken, land back on the slide

> What we concede: Qualis is real, hospice-specific, with EMR integrations we don't have, and ordering from a phone is a solved problem. What we found no public evidence of anywhere: price per day before the order, risk flagged before it's late, and a timestamped receipt that stops the billing clock. One endpoint in, one event log, one timestamp. Happy to take questions.

---

## Q&A prep (anyone can field)

- **PPD**: Beat 8 restated. Mechanisms + labeled counters, never a percentage.
- **"Qualis does this"**: concede mobile ordering + multi-vendor + 12 integrations; point at price-per-day-at-order, predictive flags with reasons, timestamped receipt, protocol vs phone calls. "Our weakest row is death-triggered pickup, and we said so first."
- **"Is the AI live right now?"** (the honest gate): the parser is built and eval-tested; in this build it runs on fixture replies behind a seam rather than a live carrier loop; the interpret-propose-confirm flow described is the production design. Do not claim live SMS.
- **"Why would vendors participate?"**: a run list on their phone with nothing to install, a reliability score they can see and dispute line by line, and round trips to swap dirty equipment cost them real money.
- **"Why SMS, not GPS?"**: location without route position is meaningless; SMS is how vendors already work; GPS refines after opt-in.
- **"Scores are fake"**: sample scores, labeled on every surface, computed not written, same formula runs on real events day one.
- **"Replay-safe?"**: duplicate deliveries with the same external event id are no-ops; say it that precisely.
- **Cost, if pressed**: $0.004/order at Anthropic list pricing for the production design; the demo parses via a flat-rate gateway at zero marginal cost; docs state both.
- GAO pre-empt: coordination fragility, not beneficiary-access harm. DOJ kicker: 2026 takedown included billing for deceased patients; our death-to-notification chain doubles as an audit artifact. Never cite recent BetterRX news; never use Part B capped-rental rules.

## Choreography

- Cast matches seed + persona roster: James Wilson PT-87411 (deceased, DME-09803: death then pickup_requested 2 min later, seeded), Maria Santos (DME-10305 flag), nurse persona Diego Ramirez. Note: James is seeded already deceased, so Tony SHOWS the existing record; there is no live status-change tap in this beat. The 2:14 AM time lives in Vin's story only; the DB timestamp will differ, the two-minute gap is the demoable fact.
- Tony's phone: signed in as Diego Ramirez, DND on, auto-lock off. Nathaniel: vendor token link pre-opened (tab on the mirrored phone or the slide laptop).
- VIN pre-stage (from demo-review): seed vendor stop data so the run list isn't empty; pull one valid /v/[token] from the DB AFTER the reset (tokens change on re-seed).
- Reset ~2:20: `scripts/reset-demo.sql` then `npm run seed && node scripts/seed-patch-conditions.mjs`. Confirm nobody advanced the prod clock after reset.
- Approvals staging no longer needed (Ellen's money view cut from the live demo); optional backup if Q&A wants to see thresholds.
- One input switch to the phone after Vin's open (the slide's own last line is the cue); Nathaniel switches to the vendor tab; end back on the slide for Q&A.
