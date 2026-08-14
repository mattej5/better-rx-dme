# Pinned Contracts — read before writing any spec or code

Owner: Vin's orchestrator session, 2026-08-14. Specs and code MUST conform. Changes to this file require team agreement, not a subagent's judgment.

## Stack

- **TypeScript strict** everywhere. Next.js (App Router) on **Vercel**. Supabase Postgres via `@supabase/supabase-js`.
- Tailwind + `betterrx-design/tokens.css` (import, don't restate).
- **No auth**: role switcher sets `{ role, userName }` client-side (cookie). Roles: `nurse` | `case_manager` | `don`. Vendors never have a role — they enter via magic-link token routes `/v/[token]`.
- **Resend** email simulates SMS (ADR 0005). All outbound comms go through one `sendMessage()` seam so real SMS can slot in.
- Skip RLS (demo). Canonical schema lives in `specs/schema.sql` + `src/types/db.ts`; Supabase is made to match the repo, never the reverse.

## Core enums (exact strings)

```ts
type OrderStatus = 'ordered' | 'dispatched' | 'in_transit' | 'delivered'
                 | 'pickup_triggered' | 'picked_up';
// AT_RISK and PICKUP_DELAYED are DERIVED badges computed from events + rules,
// never stored as status.

type OrderUrgency = 'admission' | 'routine' | 'stat';

type EventType =
  | 'order_placed' | 'approval_requested' | 'approved' | 'denied'
  | 'vendor_notified' | 'vendor_confirmed' | 'vendor_declined'
  | 'dispatched' | 'gps_opted_in' | 'eta_updated'
  | 'at_risk_flagged' | 'at_risk_cleared' | 'escalated' | 'reordered'
  | 'delivered' | 'condition_reported'
  | 'patient_status_changed'            // payload: 'deceased' | 'discharged' | 'condition_worsened'
  | 'pickup_requested'                  // THE timestamped notification (billing clock)
  | 'pickup_scheduled' | 'picked_up'
  | 'message_sent' | 'message_received' | 'resupply_due';
```

## Tables (names pinned; columns per data spec)

`patients` · `vendors` · `equipment_catalog` (from wiki/facts/dme-catalog.md) · `vendor_prices` (vendor × HCPCS) · `orders` · `order_events` (append-only, jsonb payload — the heart) · `messages` · `resupply_schedules` · `magic_links`

## Derivation rules (single source of truth)

- Reliability + condition scores: pure functions over `order_events`, variables per `wiki/facts/vendor-scoring.md`. Deterministic, no ML.
- At-risk: deterministic rules (ETA vs deadline, confirmation silence, urgency-adjusted lead-time buffers). Explainable `reason` string required on every `at_risk_flagged` event.
- Billing clock: starts at `patient_status_changed`, stops at `pickup_requested` timestamp (the notification, not the pickup — wiki/facts/reverse-logistics-and-pickup.md).
- LLM used ONLY to parse free-text vendor replies and draft outbound messages (ADR 0003), behind one `parseVendorReply()` seam with a deterministic first pass.

## Ratified amendments (orchestrator review, 2026-08-14 PM)

1. **Awaiting approval is derived, not a status**: `approval_requested` present with no `approved`/`denied` → UI chip "Awaiting approval". Status stays `ordered`.
2. **`in_transit` transition rule**: first `eta_updated` or `gps_opted_in` after `dispatched` moves status to `in_transit`.
3. **Multi-item orders**: `orders.items` is jsonb (per data spec); lifecycle is per-order (DME-09911 fidelity). The admission **bundle preset creates one order per item** — no `bundle_id` column; frontend groups bundle orders by shared placement time. Status chips stay per-item because each item is its own order; only genuinely-co-shipped items (like DME-09911) share an order.
4. **"Needed by" = `orders.target_at`** — frontend countdowns use it; no new column.
5. **`resupply_due`** is emitted on the reorder against the originating order; reminders come from querying `resupply_schedules.next_due_at` directly. `order_events.order_id` stays NOT NULL.
6. **Naming**: status `pickup_triggered` + event `pickup_requested` both stand; UI copy says "Pickup requested" (it's the billing-clock artifact). Magic-link column is **`scope`** (frontend's `purpose` → use `scope`).
7. **Post-delivery issues** reuse `condition_reported` with `payload.phase: 'delivery' | 'post_delivery'`.
8. **`derive.ts` is owned by the engine lane** (`src/lib/derive.ts`): scores, badges, billing clock as pure functions over events. Frontend imports, never re-implements. Badges are always passed into components, never inferred from status.
9. **Nudges** are `message_sent` events with `payload.kind='nudge'` + `ladder_step`; ladder state is derived by counting them (idempotent under clock jumps).
10. **DON threshold default $500** `[assumed]`, read from settings; all thresholds live in Settings (view 14) = the assumptions ledger surface.

## Spec files

- `specs/data.md` — schema.sql, TS types, seed plan, score functions
- `specs/frontend.md` — route map, views, components, data fetching
- `specs/engine.md` — API routes/server actions, rules, comms loop, magic links, demo panel
