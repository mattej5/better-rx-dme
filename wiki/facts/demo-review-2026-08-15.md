# Team demo review (Wispr Flow note, 8/15 ~6 PM)

`[team]` Source: shared Wispr note "BetterRx DME Demo Preparation". Decisions binding on pitch materials and app copy.

## Decisions

- **PPD terminology app-wide**: price per day, never price/month. Hospice pays a PPD fee, bundleable with the pharmacy PPD `[faq]`.
- **Drop "opens magic link, no login" positioning**: vendors get real login. Pitch materials must not boast no-login; don't claim built auth either (token routes are what exist today).
- **Vendor inventory = UPC scan**, not free-form numbers, incl. onboarding.
- **Demo via phone screen mirroring** (confirmed).
- **Strip AI marketing language** from vendor stops, report card, equipment setup screens.

## Demo choreography constraints (bugs caught in review)

- Frank Davis patient view leaks a hard-coded `localhost:3000` string. Do not show him on stage until fixed.
- Walter Kim timeline has duplicate at-risk flags 22 min apart + a pickup showing "open zero days". Avoid on stage.
- Vendor pages show no stops (seed gap; Vin to add seed data).
- Timeline view under each patient is the team favorite; feature it in the demo.

## Open items from the note

- Possible missing persona: bedside nurse (may do much of the communication). Handed to a follow-up investigation.
- Self-escalation bug: DON can escalate to DON; when is DON escalation actually warranted (research).
- Tony: judging criteria notes; Nathaniel: prioritize workflows for the 5-minute demo.

Related: [[pitch-plan]], [[ppd-answer]], [[rubric-self-check]]
