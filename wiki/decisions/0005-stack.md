# ADR 0005 — Stack and team decisions from kickoff planning

Date: 2026-08-14 · Status: accepted · `[team]` (planning session transcript)

- **Web app only** — no native/mobile builds; phone-first responsive web (matches BetterRX being web-based today).
- **Supabase** for DB (Vin's account, team + agents have access), **Vercel** for hosting (Vin owns deployment).
- **BetterRX visual identity** — same color scheme and typography, "BetterRX 2.0" feel; invoke the `betterrx-design` skill for any UI.
- **Notion kanban** ("Build Tasks" under AI Builder Day — Hackathon Tracker) for tasks; tag tasks with owner names so owners' agents can pick them up.
- **Git workflow**: individual branches + worktrees; Vin reviews/merges to main via Claude.
- **Slack channel** (Tony created) for comms.
- **Prize split: even three ways** — Vin, Tony (Anthony) Adair, Nathaniel Mitchell.
- Tony: read the three bounty docs. Returns/reverse-logistics research assignment now covered by [[reverse-logistics-and-pickup]].

## Added at Friday build session (second planning transcript, 2026-08-14 PM)

- **Role switcher instead of auth** — three of us can switch persona live; no login build.
- **Resend API (free email) simulates SMS** for notifications until/unless real SMS lands. Twilio A2P stays a stretch.
- **Skip RLS for the demo** — keep Supabase open; RLS is a must-have only if this goes to prod. Say so in the assumptions ledger.
- **AI manages the Supabase schema recursively** — canonical schema file lives in the repo; Supabase is made to match it, not the other way around.
- **Per-person branches**: `vin`, `anthony`, `nathaniel` (Anthony's branch is "Anthony" — not Tony). Vin creates before 5 PM venue close. Merges to main via Vin's agent review.
- **Framing**: we are building the **DME add-on to the BetterRX marketplace** — an extension of their existing platform, not a standalone product. Consistent with the BYO-vendor positioning in [[0002-demo-spine]].
