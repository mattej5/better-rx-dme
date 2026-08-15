# Rubric self-check (Nathaniel, 8/15 morning)

`[team]` Nathaniel walked the five rubric criteria against the build. Kept here: what's new, what's usable on stage, what needs correcting before it leaks into the pitch.

## New and worth using

- **Vendor incentive mechanism, his strongest point:** vendor scoring plus condition reporting gives vendors a financial reason to deliver clean, working equipment: a driver round trip to swap a dirty or broken item costs the vendor real money. The score turns that into a visible number. Folded into pitch-script Q&A ("why would vendors participate?"). `[team]`
- **Today's-market framing for differentiation:** finding vendors = phone calls, slow manual labor; no vendor incentive for clean equipment; no hospice↔vendor communication channel; PPD hard to coordinate; re-vendoring after failure is slow. Matches [competitor-products.md](competitor-products.md), usable as the "today" column narration on the differentiation slide. `[team]`

## Needs correcting before stage

- His AI-ROI answer ("AI is used to communicate with the DME vendor and update statuses") **overstates what's live**: the live SMS loop is not wired in this build. What's true: the seam, message ladder, and reply parser exist behind `parseVendorReply()`; AI parses free text only, rules do everything else. Pitch-script Beat 8 and docs/AI-APPROACH.md carry the honest version. Do not use his phrasing in Q&A.
- "Reminder SMS messages to expedite pickup" same caveat: the nudge ladder is built and tested as code, not sending live SMS on stage.
- "Nurse can request replacement equipment": condition reporting (None / Dirty / Damaged / Not working) is built; a distinct replacement-request flow is **not verified as built**. Check before anyone claims it, or say "flags it to the vendor" instead.
- Architecture ("I guess?") and UX ("ya sure") answers exist properly in docs/INTEGRATION.md and the betterrx-design work; point him there before Q&A so answers are consistent.

Related: [[pitch-plan]], [[ppd-answer]], [competitor-products.md](competitor-products.md)
