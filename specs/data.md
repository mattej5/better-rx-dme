# specs/data.md — DATA lane

Conforms to `specs/00-contracts.md` (pinned). 9 tables, exact enum strings, no renames.
Canonical artifacts this spec generates: `specs/schema.sql`, `src/types/db.ts`, `src/lib/score.ts`, `supabase/seed.ts`.

## 1. schema.sql (Postgres / Supabase)

```sql
create type order_status  as enum ('ordered','dispatched','in_transit','delivered','pickup_triggered','picked_up');
create type order_urgency as enum ('admission','routine','stat');
create type event_type    as enum (
  'order_placed','approval_requested','approved','denied','vendor_notified','vendor_confirmed',
  'vendor_declined','dispatched','gps_opted_in','eta_updated','at_risk_flagged','at_risk_cleared',
  'escalated','reordered','delivered','condition_reported','patient_status_changed',
  'pickup_requested','pickup_scheduled','picked_up','message_sent','message_received','resupply_due');
-- AT_RISK / PICKUP_DELAYED are derived badges. Never stored.

create table patients (
  id             uuid primary key default gen_random_uuid(),
  external_id    text not null unique,          -- eRx patient identifier, e.g. 'PT-88421'
  med_rec_no     text,
  first_name     text not null,
  last_name      text not null,
  dob            date,
  gender         text,
  phone          text,
  address        jsonb not null default '{}',   -- {street1,street2,city,state,zip,country}
  primary_dx     text,                          -- icd10, e.g. 'C90.00'
  hospice_name   text not null,
  emr_source     text not null default 'HCHB',
  care_status    text not null default 'active',-- 'active'|'discharge_scheduled'|'deceased'|'discharged'
  discharge_at   timestamptz,
  status_changed_at timestamptz,                -- death/discharge moment: starts the billing clock
  created_at     timestamptz not null default now()
);
create table vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  dispatch_phone text,
  dispatch_email text,
  hours          jsonb not null default '{}',   -- {mon:['08:00','17:00'],...,sun:null}
  open_weekends  boolean not null default false,
  coverage_zips  text[] not null default '{}',
  categories     text[] not null default '{}',  -- catalog categories served
  hazmat_certified boolean not null default false,
  status         text not null default 'active',-- 'active'|'invited'|'paused'
  notes          text,
  created_at     timestamptz not null default now()
);
create table equipment_catalog (
  hcpcs          text primary key,              -- 'E0260'
  plain_name     text not null,                 -- grandma rule: shown first
  category       text not null,                 -- 'bed'|'respiratory'|'mobility'|'transfer'|'consumable'
  serialized     boolean not null default true, -- serialized rentals get pickup; consumables do not
  hazmat         boolean not null default false,
  resupply_interval_days int,                   -- consumables only
  two_person     boolean not null default false,
  image_url      text
);
create table vendor_prices (
  vendor_id      uuid not null references vendors(id) on delete cascade,
  hcpcs          text not null references equipment_catalog(hcpcs),
  price_cents    integer not null,
  in_stock       boolean not null default true, -- [assumed] synthetic; live-inventory seam per ADR 0002
  lead_time_hours integer not null default 24,
  primary key (vendor_id, hcpcs)
);
create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text not null unique,          -- 'DME-10231'
  patient_id     uuid not null references patients(id),
  vendor_id      uuid references vendors(id),   -- null until assigned (DME-10231)
  status         order_status not null default 'ordered',
  urgency        order_urgency not null,
  items          jsonb not null,                -- [{hcpcs, plain_name, qty}] — multi-item orders (DME-09911)
  price_cents    integer,
  ordered_at     timestamptz not null default now(),
  target_at      timestamptz,                   -- "must arrive before discharge"
  promised_eta   timestamptz,                   -- vendor's committed window end
  current_eta    timestamptz,                   -- latest eta_updated
  delivered_at   timestamptz,
  pickup_requested_at timestamptz,              -- billing clock STOP (the notification)
  pickup_scheduled_at timestamptz,
  picked_up_at   timestamptz,
  ordered_by     text,                          -- userName from role switcher
  ordered_by_role text,                         -- 'nurse'|'case_manager'|'don'
  created_at     timestamptz not null default now()
);
create table order_events (                     -- APPEND ONLY. The heart.
  id             bigint generated always as identity primary key,
  order_id       uuid not null references orders(id) on delete cascade,
  type           event_type not null,
  payload        jsonb not null default '{}',
  actor          text,                          -- 'Maria R.' | 'Ridgeline dispatch' | 'system'
  actor_role     text,                          -- 'nurse'|'case_manager'|'don'|'vendor'|'system'
  created_at     timestamptz not null default now()
);

create or replace function order_events_append_only() returns trigger as $$
begin raise exception 'order_events is append-only'; end $$ language plpgsql;
create trigger order_events_no_mutate before update or delete on order_events
  for each row execute function order_events_append_only();
create table messages (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  vendor_id      uuid references vendors(id),
  direction      text not null,                 -- 'outbound'|'inbound'
  channel        text not null default 'email', -- 'email' simulates SMS (ADR 0005)
  to_addr        text,
  body           text not null,
  parsed         jsonb,                         -- {intent, eta?, reason?, confidence, parser:'deterministic'|'llm'}
  created_at     timestamptz not null default now()
);
create table resupply_schedules (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients(id) on delete cascade,
  hcpcs          text not null references equipment_catalog(hcpcs),
  interval_days  integer not null,
  last_delivered_at timestamptz,
  next_due_at    timestamptz not null,
  is_swap        boolean not null default false,-- oxygen: one stop = deliver full + retrieve empties
  active         boolean not null default true
);
create table magic_links (
  token          text primary key,              -- url-safe, 24 chars
  vendor_id      uuid not null references vendors(id) on delete cascade,
  scope          text not null,                 -- 'run_list'|'onboarding'|'report_card'|'stop'
  order_id       uuid references orders(id),    -- set for scope='stop'
  expires_at     timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index on orders (status); create index on orders (patient_id);
create index on orders (vendor_id); create index on orders (target_at);
create index on order_events (order_id, created_at); create index on order_events (type);
create index on messages (order_id, created_at); create index on magic_links (vendor_id);
create index on resupply_schedules (next_due_at) where active;
```

### Event payload shapes (jsonb, by type)

- `order_placed` `{ items, urgency, target_at }` · `approval_requested`/`approved`/`denied` `{ price_cents, threshold_cents, reason? }`
- `vendor_notified` `{ vendor_id, channel, nudge:boolean }` · `vendor_confirmed` `{ vendor_id, promised_eta }` · `vendor_declined` `{ vendor_id, reason, minutes_since_notified }`
- `dispatched` `{ route? }` · `eta_updated` `{ eta, source:'vendor'|'gps' }` · `gps_opted_in` `{ vendor_id }`
- `at_risk_flagged` `{ reason:string, rule:string, minutes_late? }` — **reason required** · `at_risk_cleared` `{ reason }` · `escalated` `{ to:'don'|'vendor_rep', channel }` · `reordered` `{ from_vendor_id, to_vendor_id, reason:'late'|'defect'|'declined' }`
- `delivered` `{ pod_photo_url?, signature? }` · `condition_reported` `{ phase:'delivery'|'post_delivery', functional:boolean, clean:boolean, repair:'good'|'worn'|'poor', issue:'none'|'dirty'|'damaged'|'not_working', photo_url? }`
- `patient_status_changed` `{ to:'deceased'|'discharged'|'condition_worsened' }` · `pickup_requested` `{ notified_vendor_ids:string[] }` — **billing clock stop** · `pickup_scheduled` `{ window_start, window_end, batched?:boolean, family_note? }` · `picked_up` `{ condition_photo_url }`
- `message_sent`/`message_received` `{ message_id }` · `resupply_due` `{ hcpcs, schedule_id }`

Any event may carry `vendor_note` (dispute trail) and `dispute_upheld:boolean` — upheld disputes drop out of scoring.

## 2. TypeScript types — `src/types/db.ts`

```ts
export type Role = 'nurse' | 'case_manager' | 'don';
export type OrderStatus = 'ordered' | 'dispatched' | 'in_transit' | 'delivered'
                        | 'pickup_triggered' | 'picked_up';
export type OrderUrgency = 'admission' | 'routine' | 'stat';
export type EventType =
  | 'order_placed' | 'approval_requested' | 'approved' | 'denied'
  | 'vendor_notified' | 'vendor_confirmed' | 'vendor_declined'
  | 'dispatched' | 'gps_opted_in' | 'eta_updated'
  | 'at_risk_flagged' | 'at_risk_cleared' | 'escalated' | 'reordered'
  | 'delivered' | 'condition_reported' | 'patient_status_changed'
  | 'pickup_requested' | 'pickup_scheduled' | 'picked_up'
  | 'message_sent' | 'message_received' | 'resupply_due';

export type CareStatus = 'active' | 'discharge_scheduled' | 'deceased' | 'discharged';
export type VendorStatus = 'active' | 'invited' | 'paused';
export type Category = 'bed' | 'respiratory' | 'mobility' | 'transfer' | 'consumable';
export type Iso = string;
export type Actor = Role | 'vendor' | 'system';

export interface Address { street1: string; street2?: string; city: string; state: string; zip: string; country?: string }
export interface OrderItem { hcpcs: string; plain_name: string; qty: number }
export interface ParsedReply { intent: 'confirm' | 'decline' | 'eta_update' | 'question' | 'unknown'; eta?: Iso; reason?: string; confidence: number; parser: 'deterministic' | 'llm' }

export interface Patient { id: string; external_id: string; med_rec_no: string | null; first_name: string; last_name: string; dob: string | null; gender: string | null; phone: string | null; address: Address; primary_dx: string | null; hospice_name: string; emr_source: string; care_status: CareStatus; discharge_at: Iso | null; status_changed_at: Iso | null; created_at: Iso }

export interface Vendor { id: string; name: string; dispatch_phone: string | null; dispatch_email: string | null; hours: Record<string, [string, string] | null>; open_weekends: boolean; coverage_zips: string[]; categories: Category[]; hazmat_certified: boolean; status: VendorStatus; notes: string | null; created_at: Iso }

export interface EquipmentCatalogRow { hcpcs: string; plain_name: string; category: Category; serialized: boolean; hazmat: boolean; resupply_interval_days: number | null; two_person: boolean; image_url: string | null }

export interface VendorPrice { vendor_id: string; hcpcs: string; price_cents: number; in_stock: boolean; lead_time_hours: number }

export interface Order { id: string; order_no: string; patient_id: string; vendor_id: string | null; status: OrderStatus; urgency: OrderUrgency; items: OrderItem[]; price_cents: number | null; ordered_at: Iso; target_at: Iso | null; promised_eta: Iso | null; current_eta: Iso | null; delivered_at: Iso | null; pickup_requested_at: Iso | null; pickup_scheduled_at: Iso | null; picked_up_at: Iso | null; ordered_by: string | null; ordered_by_role: Role | null; created_at: Iso }

export interface OrderEvent<P = Record<string, unknown>> { id: number; order_id: string; type: EventType; payload: P; actor: string | null; actor_role: Actor | null; created_at: Iso }

export interface Message { id: string; order_id: string; vendor_id: string | null; direction: 'outbound' | 'inbound'; channel: 'email' | 'sms'; to_addr: string | null; body: string; parsed: ParsedReply | null; created_at: Iso }

export interface ResupplySchedule { id: string; patient_id: string; hcpcs: string; interval_days: number; last_delivered_at: Iso | null; next_due_at: Iso; is_swap: boolean; active: boolean }

export interface MagicLink { token: string; vendor_id: string; scope: 'run_list' | 'onboarding' | 'report_card' | 'stop'; order_id: string | null; expires_at: Iso | null; last_used_at: Iso | null; created_at: Iso }
```

## 3. Score functions — `src/lib/score.ts`

Pure, deterministic, no ML (ADR 0004). Input: every `order_events` row belonging to that vendor's orders. Output carries per-variable subscores so the UI can print the formula (explainability = rubric differentiator).

```ts
export interface ScoreBreakdown { key: string; label: string; value: number | null; weight: number; n: number }
// score: 0–100, null when Unrated. synthetic:true rides every score surface (ADR 0004).
export interface ScoreResult { score: number | null; label: string; n_orders: number; breakdown: ScoreBreakdown[]; synthetic: true }

// ALL constants below are [assumed] defaults — configurable per hospice (guardrails philosophy).
export const MIN_ORDERS_FOR_SCORE = 5;                                    // cold-start floor
export const RELIABILITY_WEIGHTS = { on_time: 0.35, pickup_timeliness: 0.20, confirmation: 0.15, at_risk_freq: 0.15, eta_accuracy: 0.10, decline_behavior: 0.05 };
export const CONDITION_WEIGHTS = { functional: 0.30, clean: 0.25, repair: 0.20, defect_swap: 0.15, post_delivery_issues: 0.10 };
export const PICKUP_GREEN_H = 24, PICKUP_RED_H = 72;                      // no published pickup SLA exists
export const CONFIRM_FAST_MIN = 15, CONFIRM_SLOW_MIN = 240;
export const ETA_ZERO_ERR_MIN = 180;                                      // 3h ETA error scores 0
export const EARLY_DECLINE_MIN = 60, EARLY_DECLINE_WEIGHT = 0.25;         // honest early decline dings less

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const scored = (e: OrderEvent) => e.payload.dispute_upheld !== true;      // fairness: upheld disputes drop out
const mins = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60000;

function combine(parts: ScoreBreakdown[], n: number): ScoreResult {
  if (n < MIN_ORDERS_FOR_SCORE) return { score: null, label: 'Unrated', n_orders: n, breakdown: parts, synthetic: true };
  const live = parts.filter(p => p.value !== null);
  const wsum = live.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(live.reduce((s, p) => s + p.value! * p.weight, 0) / wsum);
  return { score, label: `${score}`, n_orders: n, breakdown: parts, synthetic: true };
}

export function reliabilityScore(events: OrderEvent[]): ScoreResult {
  const byOrder = groupBy(events.filter(scored), e => e.order_id);
  const orders = [...byOrder.values()];
  const n = orders.length;

  // 1. On-time delivery % — delivered_at vs the promised window end
  const delivered = orders.filter(o => has(o, 'delivered'));
  const onTime = pct(delivered, o => Date.parse(at(o, 'delivered')) <= Date.parse(promisedEta(o)));

  // 2. ETA accuracy — latest promised ETA vs actual (catches chronic optimism inside "on time")
  const errs = delivered.map(o => Math.abs(mins(promisedEta(o), at(o, 'delivered'))));
  const etaAcc = errs.length ? clamp(100 - mean(errs) * (100 / ETA_ZERO_ERR_MIN)) : null;

  // 3. Confirmation responsiveness — notify/nudge -> vendor_confirmed, median
  const rt = orders.map(o => firstGap(o, 'vendor_notified', 'vendor_confirmed')).filter(isNum);
  const confirm = rt.length
    ? clamp(100 - ((median(rt) - CONFIRM_FAST_MIN) * 100) / (CONFIRM_SLOW_MIN - CONFIRM_FAST_MIN)) : null;

  // 4. At-risk frequency — % of orders that EVER entered at-risk, recovered or not
  const atRisk = n ? clamp(100 - 100 * orders.filter(o => has(o, 'at_risk_flagged')).length / n) : null;

  // 5. Pickup timeliness — pickup_requested (the notification) -> picked_up
  const pickups = orders.filter(o => has(o, 'pickup_requested'));
  const pickup = pickups.length ? mean(pickups.map(o => {
    const sch = payloadOf(o, 'pickup_scheduled');
    if (!has(o, 'picked_up')) return hoursSince(at(o, 'pickup_requested')) <= PICKUP_GREEN_H ? 100 : 0;
    const h = mins(at(o, 'pickup_requested'), at(o, 'picked_up')) / 60;
    if (sch?.batched && h <= PICKUP_GREEN_H) return 100;                  // batched inside window: no ding
    return clamp(100 - ((h - PICKUP_GREEN_H) * 100) / (PICKUP_RED_H - PICKUP_GREEN_H));
  })) : null;

  // 6. Decline behavior — rate, weighted by how late the decline arrived
  const declineLoad = orders.reduce((s, o) => {
    const d = payloadOf(o, 'vendor_declined'); if (!d) return s;
    return s + (Number(d.minutes_since_notified) <= EARLY_DECLINE_MIN ? EARLY_DECLINE_WEIGHT : 1);
  }, 0);
  const decline = n ? clamp(100 - (100 * declineLoad) / n) : null;

  return combine([
    { key: 'on_time',           label: 'On-time delivery',        value: onTime,  weight: RELIABILITY_WEIGHTS.on_time,           n: delivered.length },
    { key: 'pickup_timeliness', label: 'Pickup timeliness',       value: pickup,  weight: RELIABILITY_WEIGHTS.pickup_timeliness, n: pickups.length },
    { key: 'confirmation',      label: 'Answers the text',        value: confirm, weight: RELIABILITY_WEIGHTS.confirmation,      n: rt.length },
    { key: 'at_risk_freq',      label: 'Orders that went at-risk',value: atRisk,  weight: RELIABILITY_WEIGHTS.at_risk_freq,      n },
    { key: 'eta_accuracy',      label: 'ETA accuracy',            value: etaAcc,  weight: RELIABILITY_WEIGHTS.eta_accuracy,      n: errs.length },
    { key: 'decline_behavior',  label: 'Decline behavior',        value: decline, weight: RELIABILITY_WEIGHTS.decline_behavior,  n },
  ], n);
}

export function conditionScore(events: OrderEvent[]): ScoreResult {
  const byOrder = groupBy(events.filter(scored), e => e.order_id);
  const orders = [...byOrder.values()];
  const reports = orders.flatMap(o => o.filter(e => e.type === 'condition_reported'));
  const atDelivery = reports.filter(r => r.payload.phase === 'delivery');
  const after      = reports.filter(r => r.payload.phase === 'post_delivery');
  const delivered  = orders.filter(o => has(o, 'delivered'));
  const n = delivered.length;

  const functional = pct(atDelivery, r => r.payload.functional === true);
  const clean      = pct(atDelivery, r => r.payload.clean === true);
  const repair     = atDelivery.length
    ? mean(atDelivery.map(r => ({ good: 100, worn: 60, poor: 0 })[r.payload.repair as string] ?? 60)) : null;
  const issues     = n ? clamp(100 - (100 * after.filter(r => r.payload.issue !== 'none').length) / n) : null;
  const swaps      = n ? clamp(100 - (100 * orders.filter(o =>
                       payloadOf(o, 'reordered')?.reason === 'defect').length) / n) : null;

  return combine([
    { key: 'functional',           label: 'Worked on arrival',   value: functional, weight: CONDITION_WEIGHTS.functional,           n: atDelivery.length },
    { key: 'clean',                label: 'Clean / sanitized',   value: clean,      weight: CONDITION_WEIGHTS.clean,                n: atDelivery.length },
    { key: 'repair',               label: 'State of repair',     value: repair,     weight: CONDITION_WEIGHTS.repair,               n: atDelivery.length },
    { key: 'defect_swap',          label: 'Defect swap rate',    value: swaps,      weight: CONDITION_WEIGHTS.defect_swap,          n },
    { key: 'post_delivery_issues', label: 'Problems found later',value: issues,     weight: CONDITION_WEIGHTS.post_delivery_issues, n },
  ], n);
}
```

**Cold start (contract with ADR 0004):** fewer than `MIN_ORDERS_FOR_SCORE` scored orders returns `score: null, label: 'Unrated'` — never zero. The vendor-compare card then ranks on the deterministic day-one fallback: hours, coverage, equipment match, price. The `breakdown` array still renders so the vendor sees what will fill in.

## 4. Seed data plan — `supabase/seed.ts`

All timestamps are **relative to a single `NOW` anchor** so the demo works on any day. Demo panel `reset` re-runs the seed. Everything labeled synthetic on-screen.

### Vendors (6)

| # | Name | Price | Hours | Coverage | Reliability | Condition | Role in demo |
|---|---|---|---|---|---|---|---|
| V1 | Ridgeline Medical Supply | mid | 7-day | wide (12 zips) | ~92 | ~88 | The dependable default. Sample Vendor 1 (DME-10198, DME-10087) |
| V2 | Gulf Coast Home Medical | high | 7-day, hazmat | wide | ~78 | ~84 | Fast STAT/oxygen, chronically optimistic ETAs. Sample Vendor 2 (DME-10305, DME-09911) |
| V3 | ValueCare DME | **cheapest** | Mon–Fri only | narrow | **~41** | **~52** | The bad one: late deliveries, worst pickup timeliness, dirty/damaged reports. Sample Vendor 3 (DME-09803) |
| V4 | Beacon Respiratory | mid-high | 7-day, hazmat | narrow, O2-only | ~89 | ~94 | Oxygen + resupply specialist; the "right choice for O2" in compare |
| V5 | Cross County Mobility | low-mid | Mon–Sat | mid | ~83 | ~90 | Mobility only — shows category filtering in compare |
| V6 | NorthStar Home Equipment | mid | 7-day | wide | **Unrated** | **Unrated** | Cold start: 2 orders of history, proves the Unrated rule on screen |

`vendor_prices`: every vendor × the catalog codes in its categories. Spread ±25% so the compare screen shows a real price delta; V3 always cheapest (the cheap-but-unreliable tradeoff is the whole point of the compare card).

### Equipment catalog (~25 rows, verbatim from `wiki/facts/dme-catalog.md`)

Beds: E0260, E0250, E0184, E0277, E0310, E0910, E0274. Respiratory: E1390, E0431 (hazmat), E0601, E0470, E0570, E0600. Mobility: E1130, E1038, E2601, E0143, E0100. Transfer/bath: E0630 (two_person), E0163, E0240. Consumables (serialized=false, resupply_interval_days set): oxygen tubing/cannula, wound dressings, incontinence briefs, foley kit, ostomy supplies. Only spot-verified codes appear on judged screens; the geri-chair code from the catalog is `[assumed]` and is omitted from seed.

### Patients (10) — eRx envelope shape

`PT-88421`, `PT-88190`, `PT-88502`, `PT-87950`, `PT-87602`, `PT-87411` (the six sample-order patients, keeping the sponsor's IDs) plus `PT-88633`, `PT-88710`, `PT-88044`, `PT-87889` to populate the roster and readiness board. Synthetic names, ICD-10 primary dx from hospice-typical set (C90.00, G30.9, I50.9, J44.9), addresses inside V1/V3 coverage zips. Care statuses: 6 active, 2 discharge_scheduled (readiness board rows), 2 deceased (pickup flows). No real data anywhere.

### The six demo orders (order_no preserved from the brief)

| order_no | Status | Vendor | Seeded event chain (relative to NOW) |
|---|---|---|---|
| **DME-10231** | `ordered` | none | `order_placed` T-6h. target_at = tomorrow 14:00. No vendor → drives the vendor-compare walkthrough live in the pitch. |
| **DME-10198** | `dispatched` | V1 | `order_placed` T-26h → `vendor_notified` → `vendor_confirmed` (+11m) → `dispatched` (route 4) → `eta_updated` today 15:40. Healthy control case. |
| **DME-10305** | `in_transit` → **AT_RISK derived** | V2 | STAT. `order_placed` T-2d → confirmed → `dispatched` → `gps_opted_in` → `eta_updated` 17:10 vs `target_at` 16:30 → `at_risk_flagged` `{reason:"ETA 5:10 PM vs discharge 4:30 PM — misses by 40 min", rule:"eta_after_target"}`. Two outbound nudges in `messages`, one free-text inbound reply for `parseVendorReply()`. |
| **DME-10087** | `delivered` | V1 | `delivered` T-27h with `{signature, pod_photo_url}` → `condition_reported` `{phase:'delivery', functional:true, clean:true, repair:'good', issue:'none'}`. |
| **DME-09911** | `pickup_triggered` | V2 | Two items (E1130 + E0601) on one order. `patient_status_changed {to:'deceased'}` T-7h05m → `pickup_requested` same minute `{notified_vendor_ids:[V2]}`. No `pickup_scheduled` yet. Billing clock shows minutes, not days — the win screen. |
| **DME-09803** | `pickup_triggered` → **PICKUP_DELAYED derived** | V3 | `patient_status_changed` T-4d → `pickup_requested` T-4d → nothing since. Two inbound family-call `message_received` rows. Elapsed counter red (>48h). The loss screen. |

### Synthetic history (makes the scores real)

~70 closed orders spread over the last 90 days, weighted so each vendor's computed `reliabilityScore` / `conditionScore` lands in its target band above — the scores are **computed from seeded events, never hardcoded**. V3 gets: 4 late deliveries, 2 late declines, 3 pickups past 72h, 5 `condition_reported` with `issue:'dirty'|'damaged'`, 1 `reordered {reason:'defect'}`. V6 gets only 2 orders → Unrated. V2 gets on-time deliveries with 60–120 min ETA error so its on-time % looks fine but ETA accuracy drags — the sub-score that proves the formula isn't decorative. One event carries `vendor_note` + `dispute_upheld:true` to demo the fairness path.

### resupply_schedules

- `PT-88190` — oxygen tubing/cannula, interval 30d, `next_due_at` = NOW+2d (fires the `resupply_due` reorder in the demo).
- `PT-87950` — wound dressings, interval 7d, next due NOW+1d.
- `PT-88633` — incontinence briefs, interval 14d, next due NOW+9d.
- **Oxygen swap:** `PT-88044`, E0431 portable cylinders, interval 14d, `is_swap:true`, vendor V4. Renders as ONE combined stop card ("deliver 2 full, retrieve 2 empty") with the hazmat badge, not two events — per `dme-catalog.md`.

### magic_links

One `run_list` token per active vendor (V1–V5, printed as a QR in the demo panel), one `report_card` token for V1 and V3 (good vs bad side by side), one `onboarding` token for V6 (status `invited` → the 60-second vendor join story).

## 5. eRx integration record shape

Mirrors the real BetterRX `meta` / `account` / `patient` envelope from `wiki/facts/integration-and-data.md`. DME product carries an **HCPCS E-code** exactly where medications carry an NDC. `[assumed]` — extrapolated from the two payloads BetterRX supplied, not a published DME spec (no e-prescribing standard exists for DME).

```ts
export interface ErxEnvelope<T extends string, B> {
  meta: { eventType: T };
  account: { identifiers: { id: string }[] };
  patient: { identifiers: { id: string; idType: string }[] } & B;
}

// product carries HCPCS exactly where a medication carries NDC
export interface ErxDmeItem {
  externalId: string;                                            // our orders.id
  product: { codeType: 'HCPCS'; code: string; name: string };    // 'E0260' / 'Hospital bed (semi-electric)'
  quantity: number; urgency: OrderUrgency; targetDateTime: Iso | null; deliveryAddress: Address;
  physician?: { identifier: { id: string; idType: 'npi' } }; notes?: string;
}

export type NewDmeOrder = ErxEnvelope<'newDmeOrder', { dmeOrders: ErxDmeItem[] }>;

export type DmeStatusUpdate = ErxEnvelope<'dmeStatusUpdate', {
  dmeOrders: {
    externalId: string; status: OrderStatus;
    derivedFlags: ('AT_RISK' | 'PICKUP_DELAYED')[];   // derived, never a status
    vendor: { id: string; name: string } | null;
    eta: Iso | null; deliveredAt: Iso | null;
    pickupRequestedAt: Iso | null;                    // billing-clock stop, timestamped + provable
    pickedUpAt: Iso | null;
    reason?: string;                                  // the at_risk_flagged explanation, verbatim
  }[];
}>;
```

Inbound direction: the EMR partner-connection layer (design against **HCHB**, mention MatrixCare/Brightree as the bi-directional precedent) pushes `newOrUpdatePatient` — we consume `demographics` into `patients` and a `deceased`/`discharged` status change into `patient_status_changed`. That inbound status path is the **redundant fallback**; the nurse's bedside button is the primary trigger. Outbound: `newDmeOrder` on placement, `dmeStatusUpdate` on every status transition, so DME spend sits beside medication spend on the same patient record (deliverable D).

## 6. Open questions

1. **Multi-item orders vs. per-item lifecycle.** DME-09911 carries two items on one order; the pinned table list has no `order_items`, so items live in `orders.items` jsonb and the lifecycle is per-order. If a judge asks "can one item be delivered and the other not?" the answer today is no. Flagged, not fixed.
2. **Scoring window.** No decay implemented — all history weighs equally. Real systems would use a rolling 90-day window. `[assumed]` to state on the scorecard.
3. **Pickup thresholds (24h amber / 72h red)** have no published source (`reverse-logistics-and-pickup.md` confirms none exists). They are configurable in settings and must carry the `[assumed]` label on screen.
4. **`resupply_due` needs an order.** `order_events.order_id` is NOT NULL, so `resupply_due` is emitted on the reorder created from the schedule, not on the schedule itself. Alternative would be a nullable FK, which weakens the heart table.
5. **Approval state is derived**, not stored — DON queue reads `approval_requested` without a later `approved`/`denied`. Fine at demo scale; would want a materialized column at volume.
6. **Vendor cost benchmarks.** Seed prices are invented spreads, not CMS PUF-derived. Grounding them in the DME PUF is a stretch task if time allows.
