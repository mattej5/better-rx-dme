# Gap review — 2026-08-15 morning (pre-judging)

Question: any problem with an obvious solution that our build does not resolve? Audit of docs/bounty/ (read fresh), wiki/transcripts/, wiki/facts/, repo HEAD f2d7fe9 (worktree == main, verified via `git diff main --stat` empty), and the live app at better-rx-dme.vercel.app (clicked through as nurse + vendor link). Claim labels: verified / inferred / assumed. [team]

**Audit limitations:** Wispr Flow MCP not connected in this session — Aug 14 meeting notes NOT re-pulled; relied on wiki/transcripts/ + wiki/sessions/ (verified those exist and were read). Notion MCP token invalid (401 on self-check, verified) — board state unknown; "N-lane largely not built" taken from Vin's brief [team], and the code audit independently confirms no comms code exists (verified).

---

## Ranked gaps (most damaging to the pitch first)

### 1. A nurse cannot place an order — the required ordering workflow is missing
- **Source:** kickoff Q&A: "You want ordering capability within the DME system?" → "Yes, absolutely. Got to be able to create that." [kickoff-qa]; brief Required Features: "Patient + equipment need (type, quantity, urgency, target date)" and "Mobile and tablet-friendly ordering at the bedside" [brief].
- **Today:** ORDER EQUIPMENT on the patient page links to `/patients/[id]/order` → **404 in production** (verified, clicked). Readiness "Order bundle" is an explicit no-write stub (`app/(hospice)/readiness/actions.ts`, verified). No `placeOrder()` anywhere in the repo; the only `order_placed` writer is the eRx ingress, which only attaches to pre-existing orders (verified). The "selection + price at order time" differentiation (Amazon on-time/price/selection framing [kickoff-qa]; competitor gap #2 "price visible to nurse at order time — verified-absent" [research]) has no surface to live on.
- **Obvious solution:** one order form page: pick catalog item (26-item catalog + per-vendor prices/lead times already seeded, verified), show 2–3 vendor options with price + typical lead time + reliability score (all data exists; `vendor-compare-card` already built, gallery-only, verified), pick urgency/target date, insert order + `order_placed` event, route through `awaitingApproval` if over threshold.
- **Feasibility:** 3–5 h, V or T lane. The data model and components exist; this is one page + one server action. Must land — it is the sponsor's only "yes, absolutely" requirement.

### 2. `/orders/[id]` does not exist — order cards, escalation, and explainability all 404
- **Source:** brief: "Escalation path to a case manager or vendor rep when a risk threshold is crossed" (required) and "Explainability. 'Why was this order flagged as at-risk?'... not a black box" (required) [brief]; rubric "visibility" [brief].
- **Today:** every order card on /today and the patient page links to `/orders/[id]` → **404** (verified, two different order ids). Readiness's at-risk banner "See options" links `/orders/[id]?sheet=escalate` → same 404 (verified). So the built rules engine's reason strings have no drill-down, and the required escalation path dead-ends. `event-timeline`, `message-bubble`, `approval-interstitial` components exist but are mounted nowhere (verified, gallery only).
- **Obvious solution:** minimal order detail page: header, status, at-risk reason (rules already emit explainable strings, verified), event timeline from the append-only log, escalate/reroute-to-backup-vendor action buttons (reroute = deliveries only, per team cut [team]).
- **Feasibility:** 1.5–2.5 h, T lane. Highest damage-to-effort ratio in this list: a judge tapping ANY card today hits a 404.

### 3. The vendor loop never closes — post-death pickup story has no payoff
- **Source:** brief shared layer: "Real-time status visible to both sides" tagged **Differentiator** [brief]; FAQ §3: baseline vendor "only ever responds via a confirmation email or text (SMS/magic-link style)" [faq]; pitch-plan.md commits to the "judge-sends-the-SMS moment (judge opens vendor magic link via QR, dashboard updates live)" [team]; kickoff: pickup "should be as immediate as possible, within 24 hours" [kickoff-qa].
- **Today:** `/v/[token]` is a hardcoded "No stops today" page that never reads the seeded `magic_links` (verified, code + clicked live). `sendMessage()` and `parseVendorReply()` do not exist; `fanout.ts` appends `message_sent` events whose payload literally says the stub arrives with the comms lane (verified). So the bedside deceased flow (T6, works, verified) emits `pickup_requested`... and no vendor is ever told, and nothing can flip it to picked-up except the demo gods. Billing-clock "days saved" math exists (verified) but the mechanism that saves the days is invisible.
- **Obvious solution:** skip SMS transport entirely (FAQ blesses magic-link as the baseline). Make `/v/[token]` real: resolve token → vendor's stops (pickup_requested + dispatched orders), one CONFIRM PICKUP / MARK DELIVERED button per stop appending the event (rules + billing already react to events, verified). QR code on the pitch slide → judge taps → hospice dashboard updates on its existing 5 s poll (verified /today polls).
- **Feasibility:** 3–4 h. N lane owns it but is absent — reassign to whoever finishes gap 2 (same event-append plumbing). This single page converts three judged claims from words to clicks: two-sided visibility, 24-h pickup, proof-of-capture (add a checkbox "left in good condition" for the condition differentiator [faq §9] at ~15 min extra).

### 4. Deliverable B (AI ROI, 15%) — CORRECTED 8/15: writeup exists, code doesn't
**Correction (Vin session, 8/15 AM):** the original version of this item said "nothing written" — wrong. `docs/AI-APPROACH.md` is written and strong (rules-vs-LLM split, named baseline, safety gates; verified read), and `specs/engine.md` §3.5 carries the full cost-per-order table. The audit lane's "no writeup" inference missed `docs/`. What REMAINS true (verified): the doc cites `src/lib/parse.ts` and an eval harness (`npm run eval:parse`, 24 fixtures) that do not exist in code — zero LLM calls anywhere in the repo. Residual risk is a judge asking "show me the parse running." Fix: either land the eval harness + parse stub (~2 h, matches engine.md §3.4/§6 exactly), or soften the pitch to "designed, specced, costed — deliberately sequenced behind the hospice-side demo." Original item kept below for the record; discount its "blank" framing.

### 4-original. Deliverable B (AI ROI, 15%) is currently a blank
- **Source:** brief: "name the rules-based or deterministic alternative and explain, specifically, why AI earns its place... include token or compute cost per patient or per order"; teams skipping safety story "scored down under AI ROI, regardless" [brief]; FAQ §6: judged "on approach and honesty about the baseline" [faq]; pitch-plan commits to a cost-per-order token table and an SMS-agent eval harness [team] — neither exists (verified: zero AI/LLM calls in repo, no eval harness, verified grep).
- **Today:** rules-only engine, which IS a sanctioned answer ("will not be penalized" [brief]) — but nobody has written the defense, and the pitch plan promises artifacts that don't exist.
- **Obvious solution:** writeup, not code. One slide/page: "Risk flagging is deterministic by design (5 rules, explainable strings — show one). The one place AI earns its seat is `parseVendorReply()` (free-text vendor SMS → structured status); deterministic first pass, LLM fallback, human-confirmed before any status change; est. ~500 tokens/order ≈ $0.01 at current Sonnet pricing [assumed — recompute against live price sheet before stating]." Drop the eval-harness promise from the pitch rather than fake it.
- **Feasibility:** 1 h, pitch lane (Vin). Zero code. Failing to write this forfeits most of 15%.

### 5. DON approval beat has nothing to approve
- **Source:** kickoff: DON "approves high-cost orders... the balance of care and cost" [kickoff-qa] (depth optional: "not saying you have to go that deep" — but we built the queue).
- **Today:** /approvals live page shows "0 pending orders" (verified, clicked). The approve/deny actions work end-to-end in code (verified). Because nothing can be ordered (gap 1), nothing new ever enters awaiting-approval; the seed's STAT order isn't in the awaiting state at the current demo clock (inferred from empty queue — not re-derived from seed data).
- **Obvious solution:** either gap 1's order form feeds it naturally (order over $500 threshold [assumed threshold — open question, Vin was calling healthcare siblings]), or seed one pending order.
- **Feasibility:** 30 min (seed tweak) or free with gap 1. Without it, a built feature demos as an empty page.

### 6. Demo-day operational hazards (small, cheap, real)
- **Reset path:** deployed /demo panel: "Reset seed (T1 stub)", scenario jumps "T2 stubs" (verified, clicked); only reset is manual SQL in the Supabase editor (verified `reset-demo.sql`). One rehearsal that mutates state (death sim works! verified in code) and there's no one-click way back before 2:50. Fix: wire reset action or pre-stage a second seeded environment. 1 h.
- **Stale/self-incriminating panel copy:** panel says "T4 rules sweep is a no-op stub" and "A 404 is expected until T10 lands" while both are actually live (rules output visible on /today, verified; `/api/erx/events` returns 405 to GET on prod = route exists, verified). If a judge sees /demo, the copy testifies against the build. 15 min copy fix.
- **Wrong reason strings:** Arthur Bell's PICKUP REQUESTED card explains itself with *discharge-deadline* language, and he appears twice on /today (verified, screenshot). Rules-engine reason/state mismatch — undermines the "explainable, not a black box" claim [brief]. 1 h, T lane.
- **/pickups is a "Nothing here yet" stub** reachable from nav (verified code; page linked from /more) while pickups are THE headline scenario. Either hide the link or redirect to /patients?segment=pickups. 15 min.

### 7. Accepted / low-priority (state, don't build)
- Discharge-readiness live scenario demoted to "if asked" (readiness board is real, read-only) — consistent with team decision [team]; fine.
- Vendor-side depth (inventory, SLA tracking, routes): FAQ §3 explicitly moves judging weight to hospice side; our assumption ledger should say so out loud [faq].
- Condition/cleanliness differentiator: conditionScore already in vendor scorecards (verified /reports has VENDORS tab); a checkbox on gap 3's confirm button upgrades it cheaply.
- Family-facing comms: cut deliberately 8/14 [team]; stale references to family notifications remain in user-scenarios.md and order-failure-recovery.md — scrub before anyone reads them aloud. 15 min.

---

## Judged deliverables A–E, current honest state

- **A. Runs:** hospice side yes (verified, clicked); but the two 404s (gaps 1–2) are inside the golden path. **At risk.**
- **B. AI vs baseline:** `docs/AI-APPROACH.md` written + cost table in engine.md §3.5 (corrected 8/15 — see gap 4). No AI in code; the doc cites a parse module and eval harness that don't exist. Defensible if pitched as "designed, not demoed."
- **C. Differentiation snapshot:** `docs/DIFFERENTIATION.md` exists (60 lines, verified present — content not audited here). Corrected 8/15; earlier "not found" inference was wrong.
- **D. Integration:** strongest area — live `/api/erx/events` ingress with idempotency + tenancy, HCHB adapter mapping, real eRx JSON shapes from FAQ §4 (verified). Say it loudly.
- **E. Scenarios:** service-failure prevention: rules fire with reasons (verified) but escalation 404s (gap 2). Post-death pickup: bedside trigger → receipt works (verified in code), vendor leg missing (gap 3). Discharge readiness: board only, by design. **2 of 3 land only if gaps 2–3 land.**

## Suggested landing order for the hours remaining
1. Gap 2 order-detail page (unblocks every card tap + escalation) — 2 h
2. Gap 1 order form — 3–5 h, parallel lane
3. Gap 3 vendor magic-link run list — 3–4 h, parallel lane
4. Gap 4 AI writeup + gap 6 quick fixes — pitch lane, 2 h total
If only ONE thing can land: gap 2, then hard-disable dead links (make cards non-clickable) so nothing 404s in a judge's hand.
