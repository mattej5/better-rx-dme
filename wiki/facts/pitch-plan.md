# Pitch Plan — storytelling and above-and-beyond proof

`[team]` 2026-08-14. 5 minutes + Q&A, 3 BetterRX judges, 2:00 PM Saturday. 55% of score = differentiation + real-problem grounding — the pitch carries as much weight as the build.

## Narrative arc (5 min)

1. **Cold open (30s) — the 2:14 AM story.** A patient dies on a Sunday night. Today: the vendor finds out from Monday's batch list; the bed sits for four days; the family calls twice; the hospice pays for every one of those equipment-days and eats the CAHPS hit. In our demo: the nurse taps one button at the bedside, the vendor is notified with a timestamp at 2:14 AM, the billing clock stops, pickup is scheduled with the family by an agent, and the driver's photo proves clean removal.
2. **Why this is broken (45s)** — causal chain from [[why-deliveries-fail]]: supplier count down 37.4% since 2013 → fewer fallbacks; orders cross an org boundary into software the hospice can't see; Brightree already captures ETA/GPS/condition photos and never shares them. **"It's a sharing gap, not a technology gap."** Pre-empt GAO: our claim is coordination fragility, not access denial.
3. **Live demo (2.5 min)** — the three scenarios in [[user-journeys]], phone-first. The **judge-sends-the-SMS moment**: judge opens the vendor magic link on their own phone (QR), confirms a delivery, dashboard updates live. (Magic-link path avoids carrier A2P risk; real SMS if Twilio cooperates.)
4. **Differentiation snapshot (45s)** — table from [[competitor-products]]: what Qualis/Dragonfly/Brightree do, and the five gaps with **"we found no public evidence that..."** framing. Never say "nobody does this." The Qualis-proof line: *"the incumbent answer to vendor non-compliance is hiring people to make phone calls; we replace the phone call with a protocol and turn the exhaust into a reliability score."* Cross-industry proof points ([[vendor-value-prop]]): CHEP's worked recovery queue for pooled assets, Frontdoor ranking 24,000 independent contractors, Happy Returns making the return a product. Open with Happy Returns if the room isn't logistics-literate; land on CHEP or Frontdoor.
5. **AI honesty + close (30s)** — [[0003-ai-scope]]: rules where rules win (cite JAMIA regex≈LLM), LLM only for messy free text; cost per order in cents; CAHPS Q6 slide — CMS already scores "did they let you know when they would arrive."

## Above-and-beyond proof artifacts (all four committed by Vin)

1. **Assumptions ledger** — one page, every `[assumed]` from the wiki: SLA windows, vendor ops, synthetic score data, after-hours staffing. Turns the brief's "state assumptions" rule into a visible artifact.
2. **Judge-sends-the-SMS demo** — strongest possible "it actually runs" proof.
3. **Cost-per-order token math** — deliverable B as a real table: tokens per SMS exchange, per order, per patient-month; vs. the deterministic path costing ~zero.
4. **Eval harness for the SMS agent** — scripted vendor-reply test set (typos, ambiguity, delay excuses, the "accident on I-15" case) with pass/fail results shown.

## Storytelling rules

- Facts from sponsor discovery quotes are the emotional ammunition — the fecal-matter wheelchair, "the DME doesn't consider themselves part of our org," the family calling twice. Use their own discovery back at them.
- Show the sponsor their own design language ([betterrx-design skill]) and their own guardrails philosophy extended to DME.
- Voice: BetterRX talks about what patients **deserve**. Use that word for the failure-recovery moments — "when the plan breaks, the patient still gets what they deserve." `[team]`
- Every number on a slide carries its label: verified / sponsor discovery / assumed. The honesty IS the differentiation from other teams.
- Pre-answer the two judge attacks: (a) "Qualis does this" → gap table rows 1/2/4/5; (b) "your score has no real data" → synthetic, labeled, accrues from real events day one.

## Open

- Who presents (see [open-questions.md](open-questions.md))
- Re-verify CAHPS Q6 verbatim wording before the slide ships

Related: [[user-journeys]], [[competitor-products]], [[vendor-value-prop]], [judging.md](judging.md)
