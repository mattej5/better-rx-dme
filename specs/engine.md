# specs/engine.md — Server actions, rules, comms, demo clock

Conforms to `specs/00-contracts.md` (pinned). Every state change is an `order_events` append. No queues, no workers, no cron — everything runs inside a request (serverless-friendly). LLM appears in exactly one place: behind `parseVendorReply()` (ADR 0003).

**Derived, never stored:** `AT_RISK` and `PICKUP_DELAYED` badges, "awaiting approval," "in transit." Status is a pure function of the event log (§0.2).

---

## 0. Foundations

### 0.1 The only write primitive

```ts
// src/lib/events.ts
export async function appendEvent<T extends EventType>(
  orderId: string, type: T, payload: Payload<T>, actor: Actor
): Promise<OrderEvent>
```

Every server action below is: validate → `appendEvent(...)` → (optionally) `sendMessage(...)` → `runRules(orderId)` → `revalidatePath()`. Nothing mutates `orders` except a denormalized `status` column written by `deriveStatus()` in the same transaction — the log stays authoritative.

### 0.2 Status derivation (pure function over events)

| Latest matching event | `OrderStatus` |
|---|---|
| `picked_up` | `picked_up` |
| `pickup_requested` \| `pickup_scheduled` | `pickup_triggered` |
| `delivered` | `delivered` |
| `gps_opted_in` or `eta_updated` after `dispatched` | `in_transit` |
| `dispatched` | `dispatched` |
| `order_placed` | `ordered` |

`awaitingApproval = has(approval_requested) && !has(approved) && !has(denied)`. **Contract note:** no `awaiting_approval` status exists in the pinned union, so the order sits at `ordered` and the UI reads the derived boolean.

### 0.3 Time

Never call `Date.now()` in domain code. Use `now()` from `src/lib/clock.ts` (§5.1). All timestamps stored UTC.

---

## 1. API surface

### 1.1 Server actions (hospice side, `src/app/actions/*.ts`)

All take `{ role, userName }` from the cookie as `actor`.

| Action | Emits | Notes |
|---|---|---|
| `placeOrder(input)` | `order_placed`, then `approval_requested` **or** `vendor_notified` | See branch below |
| `approveOrder(orderId, note?)` | `approved` → `vendor_notified` | DON only |
| `denyOrder(orderId, reason)` | `denied` | Reason required; surfaces to nurse |
| `notifyVendor(orderId, vendorId)` | `vendor_notified` + `message_sent` | Issues magic link, sends via `sendMessage()` |
| `nudgeVendor(orderId)` | `message_sent` (`kind:'nudge'`) | Manual nudge; same body the ladder sends |
| `escalateOrder(orderId, reason)` | `escalated` | One-tap from at-risk sheet |
| `reorderToBackup(orderId, newVendorId)` | `reordered` on old order, `order_placed` + `vendor_notified` on new | Human-confirmed. Old order keeps history; `payload.replaced_by` links them |
| `reportCondition(orderId, rating, photo?)` | `condition_reported` | Nurse one-tap: `none\|dirty\|damaged\|not_working` |
| `changePatientStatus(patientId, status)` | `patient_status_changed` + fan-out | §1.3 |
| `confirmPickupScheduled(orderId, window)` | `pickup_scheduled` | Usually vendor-side; nurse can record a phone call |

**`placeOrder` DON-threshold branch.** `unitPrice × qty ≥ settings.don_threshold_cents` (default **$500** `[assumed]`, editable in Settings view 14) → emit `approval_requested`, stop. Order shows "awaiting approval." Otherwise fall straight through to `notifyVendor` with the vendor chosen in the compare step. STAT orders above threshold still require approval — we do not auto-approve on urgency, and we say so on screen.

### 1.2 Magic-link token issue / resolve

```
POST  /api/vendor/link        → { token, url }   (internal; called by notifyVendor)
GET   /v/[token]              → vendor run list (RSC, no login)
```

- `magic_links(token, vendor_id, order_id?, scope, expires_at, used_at)`. `token` = `nanoid(24)`.
- Scope `run_list` (all of today's stops for that vendor) or `single_stop`.
- Resolve = single indexed lookup + `expires_at > now()`. Expiry **72h** `[assumed]`. Not single-use — the dispatcher forwards it to the driver; that's the Text-to-Track mechanic, and re-use is the feature.
- Issuing a link emits **no event** (not in the pinned union). It is a row in `magic_links` and a line in the `message_sent` payload.

### 1.3 Vendor endpoints (route handlers under `/api/v/[token]/…`)

Token resolves to `vendor_id`; no other auth. Each POST appends one event, then `runRules`.

| Route | Emits | Payload |
|---|---|---|
| `POST …/confirm` | `vendor_confirmed` | `{ eta_iso }` |
| `POST …/decline` | `vendor_declined` | `{ reason }` — feeds score honestly, triggers backup offer |
| `POST …/eta` | `eta_updated` | `{ eta_iso, source: 'vendor' }` |
| `POST …/gps` | `gps_opted_in`, then `eta_updated` | `{ lat, lng }` → naive haversine ETA, `source:'gps'`; repeats on each ping |
| `POST …/delivered` | `delivered` | `{ pod_photo_url, signature_name, delivered_at }` — **POD rides on `delivered`**; there is no `pod_captured` event |
| `POST …/pickup-scheduled` | `pickup_scheduled` | `{ window_start, window_end, family_note? }` |
| `POST …/picked-up` | `picked_up` | `{ condition_photo_url }` |
| `POST …/condition` | `condition_reported` | Vendor-side note on returned equipment |

GPS pings arrive from the driver's browser (`navigator.geolocation.watchPosition`, throttled to one POST/60s). Every `eta_updated` re-runs the at-risk rules (§2.4).

### 1.4 Bedside `patient_status_changed` handler — the fan-out

`changePatientStatus(patientId, 'deceased' | 'discharged' | 'condition_worsened')`:

1. Append `patient_status_changed` on **each** active order for the patient (payload `{ status, changed_at }`). This timestamp is the billing-clock start (§4).
2. Branch:
   - **`deceased` / `discharged`** → for every order with a serialized rental in status `delivered`: append `pickup_requested` (the timestamped notification that stops the rental clock, `[research]` reverse-logistics) → `sendMessage()` to the vendor (SMS-style + email) → `sendMessage()` to the family contact (plain-language notice) → both logged as `message_sent`. Consumables get no pickup. Oxygen cylinders get the hazmat line in the vendor message.
   - **`condition_worsened`** → no pickup. Re-run `runRules()` on every **open** order with the new (earlier) needed-by if one was supplied; urgency-adjusted buffers now bite harder (§2.5).
3. Return a receipt object for view 9: `{ vendorsNotified, notifiedAt, orders[] }`. The screen prints the timestamp large — that is the pitch cold-open.

Fan-out is a single serverless request. 4 orders × 2 messages = 8 Resend calls, sequential, ~1.5s. Acceptable; no queue.

### 1.5 Resupply

`resupply_schedules(order_id, item_code, interval_days, next_due_at)`. `generateResupplyDue()` runs on **every demo-clock advance and every dashboard load** (idempotent — guarded by `next_due_at <= now()` and no `resupply_due` event since). Emits `resupply_due`; the patient equipment card shows a one-tap reorder that calls `placeOrder` with the same vendor. Deterministic interval arithmetic, no forecasting model.

---

## 2. At-risk rules engine

`src/lib/rules.ts` — pure, synchronous, no I/O beyond the event fetch. `runRules(orderId)` loads the event log, computes flags, and appends `at_risk_flagged` / `at_risk_cleared` **only on transition** (never re-flag an already-flagged order for the same rule).

```ts
type RiskFlag = { rule: RuleId; severity: 'amber'|'red'; reason: string; firedAt: string };
// reason is a human sentence. It is required on every at_risk_flagged event.
```

### 2.1 Thresholds (all `[assumed]`, all in Settings view 14)

| Const | Value | Meaning |
|---|---|---|
| `LEAD_TIME.stat` | 4h | Expected order→delivery |
| `LEAD_TIME.admission` | 24h | |
| `LEAD_TIME.routine` | 48h | |
| `SILENCE.stat` | 30 min | Max time from `vendor_notified` to `vendor_confirmed` |
| `SILENCE.admission` | 2 h | |
| `SILENCE.routine` | 8 h | |
| `HIGH_RISK_BUFFER` | 2 h | Extra buffer for high-risk items |
| `ETA_AMBER_MARGIN` | 60 min | ETA inside this margin of deadline = amber |
| `PICKUP_AMBER` / `PICKUP_RED` | 24 h / 48 h | From `pickup_requested` timestamp |

**High-risk item** = `unit_price_cents >= 40000` **OR** `time_critical = true` in `equipment_catalog`. Time-critical seeds: oxygen concentrator E1390, portable O2 E0431, CPAP E0601, BiPAP E0470, suction E0600. Rationale: a bed arriving late is uncomfortable; oxygen arriving late is a clinical event.

### 2.2 The five rules

**R1 `eta_misses_deadline` (red).** Latest `eta_updated.eta_iso` > `needed_by`.
`"Delivery ETA 5:10 PM, discharge 4:30 PM — misses by 40 minutes."`

**R2 `eta_tight` (amber).** `needed_by - eta <= ETA_AMBER_MARGIN`.
`"ETA 4:05 PM leaves 25 minutes before the 4:30 PM discharge — no room for traffic."`

**R3 `confirmation_silence` (amber → red).** `now() - vendor_notified_at > SILENCE[urgency]` and no `vendor_confirmed`. Amber at 1×, red at 2×.
`"Sent to Valley Medical 1:04 PM. No confirmation in 2 hours (admission orders: 2 hour window)."`

**R4 `lead_time_buffer` (amber).** No ETA yet, and `needed_by - now() < LEAD_TIME[urgency] + (isHighRisk ? HIGH_RISK_BUFFER : 0)`. This is the rule that fires *before* anything visibly goes wrong, and it fires **earlier for oxygen and high-cost items** — the whole point.
`"Oxygen concentrator, no ETA yet. 5 hours to the 4:30 PM discharge; this vendor typically needs 4 hours plus a 2-hour safety buffer for oxygen."`

**R5 `pickup_delayed` (amber → red).** `now() - pickup_requested_at > PICKUP_AMBER` (red at `PICKUP_RED`), no `picked_up`.
`"Bed reported ready 4 days ago. No pickup scheduled. Family has called twice."`

Clearing: `vendor_confirmed` clears R3; an ETA inside the deadline clears R1/R2; `delivered` clears R1–R4; `picked_up` clears R5. Each emits `at_risk_cleared` with `{ rule, reason }`.

### 2.3 Vendor decline → backup offer

`vendor_declined` does **not** auto-reorder. It computes the next-best vendor from the compare ranking (price × ETA-feasibility × reliability, `wiki/facts/vendor-scoring.md`) and surfaces a one-tap confirm. `reordered` only fires on human confirm. Nothing auto-cancels — stated on screen.

### 2.4 Re-run triggers

`runRules(orderId)` is called after: `order_placed`, `vendor_notified`, `vendor_confirmed`, `vendor_declined`, `dispatched`, **every** `eta_updated`, `delivered`, `pickup_requested`, `picked_up`, and **`patient_status_changed(condition_worsened)`** (which re-runs every open order for that patient). Also on every clock advance (§5.2) and on every dashboard RSC render (cheap: one query, pure compute).

### 2.5 Urgency escalation

`condition_worsened` may carry `{ new_needed_by }`. Rules re-run against the earlier deadline; orders that were green go amber/red in the same request, and the nurse's board shows exactly which ones just moved. High-risk items cross the line first because of `HIGH_RISK_BUFFER`. This is the connector journey from `wiki/facts/user-journeys.md` made mechanical.

### 2.6 Escalation nudge ladder `[assumed]`

Evidence: multiple SMS notifications RR 1.49 vs single RR 1.09 (21-study meta-analysis, `wiki/facts/why-deliveries-fail.md`). The ladder is a feature, not a retry.

| Step | Trigger (time since `vendor_notified`, ×`SILENCE[urgency]`) | Channel / target | Event |
|---|---|---|---|
| 1 | 0.5× | Vendor dispatch — friendly reminder + magic link | `message_sent` |
| 2 | 1.0× | Vendor dispatch — named deadline, "reply YES or a time" | `message_sent` + `at_risk_flagged` (amber) |
| 3 | 1.5× | Vendor dispatch + vendor backup contact | `message_sent` |
| 4 | 2.0× | Nurse push banner + DON if high-cost | `at_risk_flagged` (red) + `escalated` |
| 5 | 2.5× | Backup vendor offer surfaced to nurse (human confirms) | `message_sent` on accept → `reordered` |

There is **no `nudge_sent` event type** in the pinned union — every ladder step is a `message_sent` with `payload.kind = 'nudge'` and `payload.ladder_step`. Ladder state is derived from counting those events, so it is idempotent under repeated clock advances.

---

## 3. Comms loop

### 3.1 The `sendMessage()` seam

```ts
// src/lib/messaging.ts
export async function sendMessage(m: {
  orderId: string; to: { channel: 'email'|'sms'; address: string; label: string };
  template: TemplateId; vars: Record<string,string>;
}): Promise<{ messageId: string }>
```

One function. Today it renders a template and calls Resend (email-as-SMS, ADR 0005); swapping in Twilio is a body change, not an architecture change. It writes a `messages` row and appends `message_sent`. Inbound writes a `messages` row and appends `message_received`.

### 3.2 Templates (plain language, grandma rule)

- **`vendor_notify`** — "New order from Riverside Hospice. 1 hospital bed for a patient in Provo. Needed **before Friday 2:00 PM**. Tap to confirm: {link}. Or just reply with a time."
- **`vendor_nudge`** — step-aware, escalating specificity, never scolding: "Still need a time for the Provo bed — the patient goes home at 2:00 PM Friday. Reply YES or a time."
- **`vendor_pickup`** — "The patient at 412 Oak has passed away. The hospital bed and oxygen concentrator are ready for pickup. Notified {timestamp}. Family prefers after Tuesday. Tap for the address: {link}."
- **`family_delivery`** — "Your hospital bed arrives today between 2 and 4 PM."
- **`family_pickup`** — "We've asked the equipment company to pick up the bed. They'll call you to pick a time. You don't need to do anything."
- **`family_failure_recovery`** — the "deserve" voice: *"Your father's oxygen is running late, and you deserve to hear that from us rather than find out at the door. We've already put a second supplier on it. Here's what we know right now: {status}. Someone from our team will call you within the hour."*

Never: "per our records," "as previously communicated," "we apologize for any inconvenience."

### 3.3 Inbound (demo panel simulated inbox)

`POST /api/demo/inbound { vendorPhoneOrEmail, body }` → resolve to vendor + most recent open order → append `message_received` → `parseVendorReply()` → act. Judges type free text into a fake phone on the demo panel and watch the timeline update. Same code path a real Twilio webhook would hit; the webhook handler is a 10-line adapter we describe but don't build.

### 3.4 `parseVendorReply()` — deterministic first, LLM second

```ts
type ParseResult = {
  intent: 'confirm'|'decline'|'eta'|'delay'|'question'|'unknown';
  eta?: string;                 // ISO
  reason?: string;              // free text, for decline/delay
  confidence: number;           // 0–1
  method: 'regex'|'llm';
};
```

**Pass 1 — regex (no cost, ~0.1ms).** Handles the structured majority:
- `/^\s*(y|yes|yep|ok|okay|confirmed?|👍|10-4)\b/i` → `confirm`, conf 0.99
- `/^\s*(n|no|nope|can'?t|cannot|unable|decline)\b/i` → `decline`, conf 0.95
- `/\b(eta|by|around|at)?\s*(\d{1,2})(:(\d{2}))?\s*(am|pm)\b/i` → `eta`, conf 0.9, resolved against the order's date and the hospice's timezone
- `/\bin\s+(\d+)\s*(min|minutes|hr|hour|hours)\b/i` → `eta` relative, conf 0.9
- Bare confirm + time (`"yes, 3pm"`) → `confirm` with `eta`

If pass 1 returns `unknown` **or** the message is >12 words with no clean match, fall through.

**Pass 2 — LLM.** `claude-opus-5`, structured output, grounded in the order context, `effort: "low"`. Thinking left at the model default (adaptive) — we deliberately do **not** set `thinking: {type:"disabled"}`, which on Opus 5 risks internal tags leaking into output; low effort gets the cost saving without that failure mode.

```ts
const res = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 2000,
  system: [{ type: "text", text: PARSE_SYSTEM, cache_control: { type: "ephemeral" } }],
  output_config: {
    effort: "low",
    format: { type: "json_schema", schema: {
      type: "object", additionalProperties: false,
      required: ["intent","confidence"],
      properties: {
        intent: { type: "string", enum: ["confirm","decline","eta","delay","question","unknown"] },
        eta: { type: "string" }, reason: { type: "string" },
        confidence: { type: "number" },
      },
    }},
  },
  messages: [{ role: "user", content: buildUserBlock(order, message) }],
});
```

`PARSE_SYSTEM` is the stable prefix (~700 tokens: role, intent definitions, timezone rule, "if you cannot tell, return unknown with low confidence — never guess an ETA"). It sits above the 512-token cache minimum for Opus 5, so every parse after the first is a cache read. The volatile order context and the message body go in the user block, below the breakpoint.

**Safety gate.** `confidence < 0.75` → no state change. The parse is written to the timeline as "we read this as X, please confirm," and a nurse taps to accept or correct. High-stakes actions (`reorderToBackup`, `escalateOrder`) are **always** human-confirmed regardless of confidence. The parsed interpretation is rendered under the raw message on the order timeline (view 6) — explainability is visible, not claimed.

**Baseline we beat.** Regex alone on the eval set (§6). We report both numbers. JAMIA Open 2025: regex ≈ LLM on structured extraction (89.2% vs 87.7%, P=.56) and 18,404× faster — so we run regex first and pay for the LLM only on the messy tail, which is exactly the subset where it wins.

### 3.5 Cost per order (deliverable B)

Assume ~2.2 vendor replies per order; regex handles ~70% at zero marginal cost.

| Path | Calls/order | In (cached / fresh) | Out | Cost @ Opus 5 ($5/$25 per MTok) |
|---|---|---|---|---|
| Regex only (70%) | 0 | — | — | **$0.0000** |
| LLM parse (30%) | 0.66 | 700 cached (@$0.50/MTok) + 250 fresh | ~120 | **$0.0043** |
| Outbound draft (optional, off by default) | 0.3 | 400 cached + 150 | 200 | $0.0021 |
| **Total, parse only** | | | | **≈ $0.004 / order** |
| **Total, parse + drafting** | | | | **≈ $0.007 / order** |

At 20 DME orders/week for a 100-patient hospice `[assumed — open question]` that is **under $5/year in inference**. Cache-read pricing (~0.1×) does the heavy lifting; the first request of each cold window pays a 1.25× write. If a team decides latency or cost matters more than headroom, `claude-haiku-4-5` ($1/$5) drops this ~5×, but that is a deliberate call, not a default — we ship Opus 5 and say so.

---

## 4. Billing clock + equipment-days-saved

**Clock start** = `patient_status_changed.changed_at`. **Clock stop** = `pickup_requested.created_at` — the *notification*, not the pickup. Grounded in the model hospice/DME agreement: rental bills until the earliest of (a) the date the hospice notifies the supplier, or (b) actual pickup if never notified (`wiki/facts/reverse-logistics-and-pickup.md`, `[research]`).

```ts
notificationLagHours = pickup_requested.at − patient_status_changed.at   // ours: seconds
baselineLagHours     = BASELINE_NOTIFY_LAG_H                            // 26h [assumed]
daysSaved            = max(0, (baselineLagHours − notificationLagHours) / 24)
dollarsSaved         = daysSaved × item.daily_rental_cents
```

`BASELINE_NOTIFY_LAG_H = 26` models the model contract's **daily business-day batch list**: a Saturday-night death is not reported until Monday morning. 26h is the labelled assumption; it is editable in Settings and the label rides the number on the DON report (view 12, "Saved" tab).

The counter is a sum over all orders in the period. Two numbers on screen: **equipment-days avoided** and **dollars**, with a footnote naming the assumption and the contract clause. Pickup *timeliness* (notification → `picked_up`) is tracked separately as a vendor score input — it is the vendor's cost problem, not the hospice's. We do not conflate them.

---

## 5. Demo control panel

Hidden route `/demo` (view 21). Build this first; the pitch depends on it.

### 5.1 Virtual clock — how DME-10305 goes at-risk live

The whole demo hinges on time moving. There is no worker, so time is an **offset, applied on read, advanced on demand.**

```ts
// src/lib/clock.ts
// demo_state: single row { clock_offset_seconds: int, seeded_at: timestamptz }
export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getOffsetSeconds()) * 1000);
}
```

- Seed data is written **relative to seed time** (`needed_by = seededAt + 6h`), so the scenarios are correctly staged the moment you reset, on any day.
- `POST /api/demo/advance { minutes }` does three things in one request: bump `clock_offset_seconds`; run `sweepAllOpenOrders()` (which calls `runRules` per order, fires any due ladder steps, and runs `generateResupplyDue()`); `revalidatePath('/', 'layout')`. Rules are idempotent — advancing 60 minutes in one jump produces the same event log as six 10-minute jumps, because every rule tests a condition against the log rather than counting ticks.
- Client screens use SWR with `refreshInterval: 5000`, so the judge's phone updates without a reload.
- **Optional auto-tick**: a `<DemoHeartbeat/>` component on the demo panel POSTs `advance { minutes: 1 }` every 5 real seconds. That gives "watch it go red while I talk" with zero server-side scheduling. Toggle on the panel. Presenter can also hit **+15m** manually — that is the reliable path and the one we rehearse.
- **DME-10305 specifically**: seeded with ETA 5:10 PM, discharge 4:30 PM, status `dispatched`, no risk flag yet (the seeded ETA is written as "not yet reported"). One tap on **"Vendor reports ETA"** posts `eta_updated` → `runRules` → R1 fires → `at_risk_flagged` with the reason string → red badge + banner appear on the nurse's phone mid-sentence.

### 5.2 Panel endpoints

| Route | Does |
|---|---|
| `POST /api/demo/reset` | Truncate + reseed all tables, offset := 0, `seeded_at` := now |
| `POST /api/demo/advance` | §5.1 |
| `POST /api/demo/scenario` | Jump to a named state: `discharge_ready`, `at_risk_10305`, `pickup_triggered`, `pickup_delayed_09803`, `resupply_due`. Each replays a scripted event sequence through `appendEvent` — never a raw DB write, so the timeline stays honest |
| `POST /api/demo/inbound` | Simulated vendor SMS (§3.3) |
| `GET /api/demo/qr` | PNG QR for the current vendor magic link — judge scans, opens the run list on their own phone. This is the demo's best 10 seconds |
| `GET /api/demo/state` | Virtual now, offset, order/badge counts (presenter's sanity check) |

Guard: all `/api/demo/*` return 404 unless `process.env.DEMO_MODE === 'true'`.

---

## 6. Eval harness (deliverable B evidence)

`npm run eval:parse` → `scripts/eval-parse.ts`. No test framework, no network mocking ceremony.

Fixtures in `evals/vendor-replies.json`, 24 cases, each `{ id, message, orderContext, expected: { intent, eta?, minConfidence } }`:

- **Structured (8)** — `"YES"`, `"yes 3pm"`, `"Y"`, `"Confirmed, ETA 14:30"`, `"NO"`, `"can't do it"`, `"ETA 5:10 PM"`, `"in 45 min"`
- **Messy — LLM should win (10)** — `"stuck behind an accident on I-15, maybe 2hrs"`; `"got it but the bed is on the other truck, tomorrow am ok?"`; `"driver called in sick, can someone else take it"`; `"we can do it but not till after 6"`; `"yeah no problem"`; `"kk"`; `"which house is it again"`; `"O2 needs a hazmat driver, none till Monday"`; `"sure thing boss 👍 bout an hour"`; `"who is this"`
- **Adversarial / must-not-guess (6)** — `"ok"` alone (ambiguous ack vs confirm); `"no problem"` (means yes, not decline); `"maybe"`; `"?"`; empty string; a wrong-number reply

Runner: for each case, run regex-only, then the full hybrid. Emits a pass/fail table plus the two headline numbers.

```
CASE                          REGEX      HYBRID     EXPECTED
structured/yes-3pm            PASS       PASS       confirm eta=15:00
messy/i15-accident            FAIL       PASS       delay  eta=+2h
adversarial/no-problem        FAIL       PASS       confirm
adversarial/maybe             PASS*      PASS       unknown  (*by accident)
─────────────────────────────────────────────────────────────
Regex baseline   14/24 (58%)   |  cost $0.00   |  0.4 ms total
Hybrid           22/24 (92%)   |  cost $0.031  |  4.1 s total
LLM invoked on 11/24; 2 correctly returned low confidence → human confirm
```

The last line is the point: the two it "fails" are cases where it declined to guess and handed off to a human. That is the safety story with a number attached. Exit code 1 if hybrid drops below 20/24, so a prompt edit can't silently regress during the build.

---

## 7. Open questions

1. **DON threshold** — no sponsor number exists (`wiki/facts/open-questions.md`). $500 is `[assumed]` and configurable. Ask in Slack; if answered, update the seed.
2. **Orders per hospice per week** — needed to make the §3.5 cost table a real annual figure rather than an assumed one. Already on the open-questions list.
3. **`in_transit` trigger** — we derive it from the first post-dispatch `eta_updated`/`gps_opted_in`. If the pinned union later gains an explicit transit event, this derivation changes. Flagging so the frontend lane knows the rule.
4. **Timezone** — single hospice timezone in `settings` (`America/Denver` seeded). Multi-timezone parsing of "3pm" is out of scope for 24h; stated in the assumptions ledger.
5. **Baseline notification lag (26h)** — the single most load-bearing assumption in the dollars-saved number. No measured data exists. It is labelled on screen and in the deck; if a judge pushes, the honest answer is "we modelled the business-day batch list in the model contract; here's the slider."
6. **Family contact source** — assumed present on the patient record. Real EMR mapping is in the integration sketch (deliverable D), not built.

---

## 8. Event emission audit

Every event this spec emits, checked against the pinned `EventType` union. Nothing else is emitted anywhere.

`order_placed` ✓ · `approval_requested` ✓ · `approved` ✓ · `denied` ✓ · `vendor_notified` ✓ · `vendor_confirmed` ✓ · `vendor_declined` ✓ · `dispatched` ✓ · `gps_opted_in` ✓ · `eta_updated` ✓ · `at_risk_flagged` ✓ · `at_risk_cleared` ✓ · `escalated` ✓ · `reordered` ✓ · `delivered` ✓ · `condition_reported` ✓ · `patient_status_changed` ✓ · `pickup_requested` ✓ · `pickup_scheduled` ✓ · `picked_up` ✓ · `message_sent` ✓ · `message_received` ✓ · `resupply_due` ✓

**Deliberately not events** (would have required union changes we are not authorized to make): magic-link issue (row in `magic_links` only), nudge (`message_sent` with `kind:'nudge'`), POD capture (payload on `delivered`), pickup-delayed (derived badge), clock advance (demo state, not domain).

---

## Addendum (orchestrator, 8/14 PM — team call decisions)

1. **eRx/EMR ingress**: implement `POST /api/erx/events` per contracts (envelope mapping, `external_id` idempotency, `account.identifiers` tenancy). Demo panel's "simulate EMR death event" MUST call this route, not a shortcut.
2. **Twilio SMS replaces Resend as vendor transport** (Nathaniel: account + `TWILIO_*` env vars in Vercel). Keep `sendMessage()` seam; Resend stays for family notices + fallback. Cost note for deliverable B: ~$0.0087/SMS.
3. **Staged status model** (Amazon pattern): vendor_confirmed → out_for_delivery ("on my way" reply or magic-link tap) → arriving (GPS opt-in refines ETA). GPS never primary; it can't reveal route position.
4. **Replacement-request flow** (new): nurse taps "Request replacement" on a condition_reported issue → `reordered` event with reason `defect` → same-vendor redelivery request first (they eat the trip — the incentive), backup vendor offered if declined/late. Feeds condition score.
5. **Vendor SLA terms**: `vendors.sla jsonb` (delivery window hours by urgency, pickup window) — per-vendor terms tracked against actual performance on the scorecard. Defaults from Settings, labeled assumed.
6. **Family call logging**: "family called" pressure flag needs provenance — `message_received` with `payload.from='family'` via a one-tap "Log family call" on the pickup tracker row.
