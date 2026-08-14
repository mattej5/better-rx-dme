# ADR 0003 — AI scope: rules where rules win, LLM only for messy language

Date: 2026-08-14 · Status: accepted · `[team]`

## Decision

**Deterministic (rules):** at-risk flagging core (ETA vs deadline, confirmation silence thresholds), billing-clock timestamps, structured SMS reply parsing ("YES", "ETA 3PM"), escalation ladder timing, reliability score arithmetic.

**LLM:** parsing unstructured vendor free text ("stuck behind an accident on I-15, maybe 2hrs" → structured delay + new ETA + reason), drafting outbound vendor/family messages, triaging ambiguous replies with confidence flags and human confirmation for high-stakes actions (reorder, escalation).

**GPS:** on dispatch, driver gets a magic link; tap = GPS opt-in = live ETA; no tap = SMS check-in ladder (multiple nudges — meta-analysis RR 1.49 vs 1.09 single).

Dropped: A2A agent-to-agent concept (no clean baseline story — Vin flagged the dud risk himself).

**Amendment 2026-08-14 PM (last-30-days sweep, [[last-30-days-2026-08]]):** A2A stays un-built, upgraded from "dropped" to **"answered on the architecture slide."** In-window evidence: MCP consolidating (major spec revision 2026-07-28), A2A adoption pre-dates window with no healthcare vertical, zero production agent-to-agent B2B anywhere in healthcare/logistics. A2A is transport, not inference — nothing for the AI-ROI baseline to beat. The honest story: our magic-link JSON contract is already the machine interface; a vendor's agent can POST the same payload a dispatcher answers by SMS. One slide line, ~20 min. Conditional thin endpoint only if core demo green by ~8 PM; never a two-sided A2A demo (both agents ours = self-dealing theater).

## Why

- Rubric explicitly rewards "rules-based is better here" honesty and punishes LLM-as-lookup-table.
- JAMIA Open 2025: regex ≈ LLM on structured extraction (89.2% vs 87.7%, P=.56), 18,404× faster. LLM edges ahead only on messy subsets — exactly where we deploy it. Cite this in deliverable B.
- Free-text vendor SMS genuinely cannot be parsed deterministically (typos, idiom, ambiguity) — the one place AI beats the baseline, and we can prove it with the eval harness ([[pitch-plan]]).
- Safety story: grounded in order context, confidence-flagged, human-confirmed before reorder/escalation. Cost story: cents per order; deterministic path costs ~zero.

Related: [[why-deliveries-fail]], [[0004-reliability-score]]
