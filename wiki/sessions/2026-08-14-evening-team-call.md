# Session 2026-08-14 (evening) — Team call: design review + comms decision + demo plan

Full Wispr note: "Better Rx DME App Design". Decisions ingested across two passes (pasted excerpt, then full note).

## Decisions

- **Twilio SMS is the vendor channel** (Nathaniel owns setup). Telegram rejected (app install), GPS demoted to supporting signal, email = fallback. AI agent mediates driver SMS ↔ app status, strictly tool-choice constrained; Gemini key candidate behind the provider-agnostic seam. → ADR 0003 amendments, engine addendum.
- **Proof of delivery = signature or photo + timestamp**; timestamp alone insufficient. Photo doubles as forgotten-equipment evidence.
- **Replacement-request flow** for dirty/damaged deliveries (Nathaniel) — vendor eats the second trip; stronger incentive than the score. → kanban P1.
- **Vendor onboarding v2**: equipment + quantities + pricing model + city/zip + radius service area (vendor chooses own radius); uncovered-zip opportunity view as stretch. → kanban P1.
- **Pickups cannot reroute to a backup vendor** — owning vendor retrieves its own equipment. Escalation = nudge cadence (window start / halfway / near deadline) + score + idle-inventory incentive. → engine addendum #7.
- Family time-change notices: discussed, then **cut** — no family-facing comms in v1.
- **Demo scenarios: post-death pickup + service-failure prevention.** Pitch = slides + app swipes, two invented families, ~1-min story/demo alternation; integration lives in repo docs + one diagram.
- eRx/EMR integration = per-system `adapter.ts` pattern; ingress webhook closes the readiness gap (prior turn).

## Facts and flags

- Waiver: winner's code becomes BetterRX property for the $10k; Tony + Nathaniel not yet invited/signed — chase.
- BetterRX does delivery time windows today; a customer review complained a 6-hour window is too wide `[team]` — supports our tighter-window + at-risk framing.
- Nathaniel's skeptic list: $500 DON threshold (assumed — Vin calling healthcare siblings), case-manager role (resolved: sponsor-verbatim persona, [personas.md](../facts/personas.md)), "equipment days avoided" copy clarity (fixed via DME PPD header + explainer), "they've called twice" provenance (fixed via Log-family-call, engine addendum #6).
- Design feedback applied via Claude Design: persona labels per screen, approvals badge, report-card improvement tips, SMS thread screen, staged statuses.
- Two Slacks with near-identical names; team one has spaces.

## Open

- Discharge-readiness scenario meaning ([open-questions](../facts/open-questions.md))
- Vin: Vercel project, Supabase access for Tony/Nathaniel, sibling calls, Slack icon
- Nathaniel: Twilio + Gemini env vars, FAQ re-read
