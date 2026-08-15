# 2026-08-14 late night — Vin lane orchestration (V1–V14)

Orchestrator session, agent-driven. Everything below is on `main` and live at https://better-rx-dme.vercel.app.

## Shipped (commits 6ca0677 → 0978f2c)

- **V1 Done.** All Vercel env slots exist (prod+dev). TWILIO_* and SUPABASE_URL real; SUPABASE_SERVICE_ROLE_KEY / GEMINI / ANTHROPIC / RESEND are `TODO_SET_ME` placeholders. [team]
- **V2 Done.** Shell, bottom tab bar, role switcher (cookie, pinned role strings), `/v/[token]` outside the shell. Verified at 390pt on prod.
- **V3 applied.** `specs/schema.sql` (11 tables) live on Supabase project `fwssbyjrrznzlrkswlcn`, applied through the dashboard SQL editor; trigger + external_id uniques verified. `src/types/db.ts` generated. Remaining human step: paste service_role key into Vercel + `.env.local`; invite Tony + Nathaniel to the Supabase project.
- **V13 Done.** Nine primitives + supports, fixture page `/dev/components`. Enums verbatim from contracts.
- **V5, V4, V9, V14, V6, V7, V8 code complete**, each Opus-reviewed before merge; all wired against the derive stub so T3 lights up badges with zero edits. Marked Done on the board only after seed-data verification.
- **V10, V11 Done.** `docs/ASSUMPTIONS.md`, `AI-APPROACH.md`, `DIFFERENTIATION.md`, `INTEGRATION.md`, HCHB adapter stub, README judging section.

## Seams created for other lanes (import, don't re-create)

- `src/lib/events.ts` — engine §0.1 `appendEvent` + §0.2 priority-table `deriveStatus`, virtual-clock timestamps. [team]
- `src/lib/derive.ts` — loud STUB, T3 replaces wholesale. Interface per data.md §3 incl. `breakdown`.
- `src/lib/clock.ts` — virtual `now()` over `demo_state.clock_offset_seconds`.
- `src/lib/settings-defaults.ts` — single source for guardrail defaults incl. `high_risk_buffer_h=2`, `eta_amber_margin_min=60`.

## Facts learned / surprises

- The published Claude Design canvas is not agent-readable (cross-origin iframe; only frame 4a renders). Spec + tokens were styling authority; a Vin eyeball pass vs the canvas is optional polish. [team]
- Review pass caught a real PPD bug: monthly price over clock-truncated census-days inflated the headline ~2.2×. Now daily accrual; headline and per-patient table reconcile by construction. [team]
- `HOSPICE_TIMEZONE = America/Denver` is a single const in `domain.ts` [assumed]; engine.md expects a settings-seeded timezone — T1 can seed `settings.timezone` and we swap to a read.
- SMS cost (~$0.026/order) is ~6× LLM inference cost (~$0.004/order) — the cost slide should lead with Twilio, not tokens. [research, derived in docs/AI-APPROACH.md]
- Demo death button already POSTs the full envelope with a **stable** per-patient `external_id`, so pressing it twice demos T10's replay no-op live. [team]

## For Vin (human steps)

1. Paste Supabase `service_role` key into Vercel env (replace TODO_SET_ME) and `.env.local`. 2 minutes; unblocks all data reads on prod.
2. Slack the team: "Branches are up: vin / tony / nathaniel — work in yours, merges to main go through my agent review." (branch card stays In Progress until posted)
3. Optional: eyeball prod screens vs the design canvas.

## Open

- V12 pitch deck: Saturday morning, human, untouched per plan.
- T10 route is the only 404 in the demo death path; flagged on T10's card with the exact envelope shape.
