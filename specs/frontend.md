# specs/frontend.md — Route map, views, components, data fetching

Conforms to `specs/00-contracts.md` (pinned). Next.js App Router, TS strict, Tailwind + `betterrx-design/tokens.css` (import, never restate). Phone-first at **390×844 for every view and every persona**; desktop is a max-width bump only. Plain language everywhere (grandma rule): plain equipment name large, HCPCS small and secondary.

Priorities are the handoff prompt's: **P0** = demo spine, **P1** = supporting, **P2** = credibility/edge. Build order = P0 top-to-bottom, `/demo` alongside the first P0 view (the pitch depends on it).

---

## 1. Route map — all 22 storyboard views

### Hospice (role cookie, no auth)

| # | Storyboard view | Route | Pri |
|---|---|---|---|
| 1 | Role switcher (demo login) | `/` | P2 (tiny — ship with the shell) |
| 2 | Today (home), per role | `/today` | P1 |
| 3 | Patient roster | `/patients` | P2 |
| 4 | Patient equipment card | `/patients/[patientId]` | **P0** |
| 5 | New order flow (3 steps) | `/patients/[patientId]/order?step=items\|when\|vendor` | **P0** |
| 5b | Approval interstitial | `/patients/[patientId]/order/submitted` | **P0** |
| 6 | Order detail + timeline | `/orders/[orderId]` | **P0** |
| 7 | Readiness board | `/readiness` | P1 |
| 8 | At-risk alert + escalation sheet | `/orders/[orderId]?sheet=escalate` (overlay, deep-linkable) | **P0** |
| 9 | Bedside status-change flow | `/patients/[patientId]/status-change` | **P0** |
| 9b | Status-change receipt (2:14 AM screen) | `/patients/[patientId]/status-change/receipt?event=[eventId]` | **P0** |
| 10 | Pickup tracker | `/pickups` | P1 |
| 11 | DON approvals queue | `/approvals` | P1 |
| 12 | DON reports | `/reports?tab=ppd\|vendors\|saved` | P1 — **cost tab header is "DME PPD"**: headline number = DME spend ÷ census-days, rendered beside Med PPD; per-patient table below. The buyer's metric, on screen, per `wiki/facts/ppd-answer.md`. |
| 13 | Vendor management + invite | `/admin/vendors`, `/admin/vendors/[vendorId]`, `/admin/vendors/invite` | P2 |
| 14 | Settings / guardrails | `/settings` | P2 |

### Vendor (magic-link token, zero login)

| # | Storyboard view | Route | Pri |
|---|---|---|---|
| 16 | Run list (today) | `/v/[token]` | **P0** |
| 17/18 | Stop card — delivery / pickup / oxygen-swap | `/v/[token]/stop/[orderId]` | **P0** |
| 15 | Onboarding accept page | `/v/[token]/welcome` | P1 |
| 19 | Vendor report card | `/v/[token]/scorecard` | P1 |

One `[token]` param, one lookup, four pages. `/v/[token]/welcome` is where an `invite`-purpose token lands; a `run`-purpose token lands on `/v/[token]`. Redirect is decided in `app/v/[token]/layout.tsx` from `magic_links.purpose`.

### Shared / meta

| # | Storyboard view | Route | Pri |
|---|---|---|---|
| 21 | Demo control panel | `/demo` | **P0** (build first, with view 4) |
| 22 | Assumptions ledger | `/assumptions` | P2 (linked from every footer) |
| 20 | Family status link (stretch) | `/f/[token]` | P2 |

### File layout

```
app/
  layout.tsx                 tokens.css, fonts, <RoleProvider> from cookie
  page.tsx                   role switcher
  (hospice)/layout.tsx       AppShell: header, role pill, footer w/ assumptions link
    today/ patients/ orders/ readiness/ pickups/ approvals/ reports/ admin/ settings/
  v/[token]/layout.tsx       VendorShell: no role cookie read, no nav
    page.tsx  welcome/  stop/[orderId]/  scorecard/
  f/[token]/page.tsx
  demo/page.tsx
  assumptions/page.tsx
components/                  see §3
lib/  supabase.ts  role.ts  derive.ts (re-export from engine lane)  format.ts
```

---

## 2. P0 view specs

Every P0 view: loading = skeleton card stack (never a spinner alone), error = plain-language card ("We couldn't load this. Try again." + retry button), empty = one sentence + the primary action.

### 2.1 `/patients/[patientId]` — Patient equipment card

- **Purpose.** Everything in this home right now, one screen. Entry point to both P0 flows.
- **Components.** `PatientHeader` (name, MRN small, `synced from HCHB` chip), list of `EquipmentRow` (photo, plain name, HCPCS small, `StatusChip`, resupply due date), `BigActionButton` ×2 — `ORDER EQUIPMENT` (salmon) then `PATIENT STATUS CHANGE` (slate, physically larger, bottom-anchored), `ResupplyNudge`, `SyntheticLabel` in footer.
- **Data.** `patients` by id; `orders` where `patient_id` eq, joined `equipment_catalog`; latest `order_events` per order for chip + derived badges; `resupply_schedules` for next-due.
- **States.** Loading skeleton = 3 grey rows. Empty = "No equipment in this home yet." + ORDER button. **At-risk variant**: any order with derived `AT_RISK` pins a red-tint `RiskBanner` above the list with the `reason` string and a link into `/orders/[id]?sheet=escalate`. **Pickup-delayed variant**: purple→red row with elapsed-days counter. **Just-went-amber variant**: after a `patient_status_changed` event within the last 10 min, banner reads "This patient's needed-by dates moved earlier. 2 orders just went at risk." with a count and a per-order list.

### 2.2 `/patients/[patientId]/order` — New order flow (3 steps, <60s)

Single route, `?step=` search param so browser Back works and the demo can deep-link. Draft held in `sessionStorage` (`orderDraft:<patientId>`) — no server round-trip until Place Order.

- **step=items.** `CategoryAccordion` over `equipment_catalog` categories (bed & positioning, respiratory, mobility, transfer/bathroom, consumables). Photo + plain name + small HCPCS. `BundlePreset` one-tap "Typical admission bundle" (bed + mattress + concentrator + commode + walker). Sticky bottom bar: "3 items · Next".
- **step=when.** Three big `UrgencyToggle` cards using pinned `OrderUrgency` — `admission` / `routine` / `stat`, labelled **Admission · Routine · STAT**. Target date-time picker with a plain sentence echo: "Must arrive before discharge, Fri 2:00 PM." `AssumedLabel` on the SLA hint.
- **step=vendor — the Amazon moment.** `VendorCompareCard` per vendor, ranked: price, ETA with ✓ meets / ✗ misses deadline, reliability score, condition score, hours badge ("Open Sundays"), stock label with `AssumedLabel`. Unrated vendors say **Unrated**, never 0. Primary button `PLACE ORDER`.
- **Data.** `equipment_catalog`; `vendor_prices` (vendor × HCPCS) joined `vendors`; reliability + condition from `derive.ts` pure functions over `order_events`; DON threshold from settings.
- **Writes.** Server action `placeOrder()` → `orders` row + `order_placed` event; if over threshold also `approval_requested`.
- **States.** Empty vendor list = "No contracted vendor carries this item. Ask your DON." Error on submit keeps the draft. If over threshold, route to `/order/submitted` = `ApprovalInterstitial`.

### 2.3 `/orders/[orderId]` — Order detail + timeline

- **Purpose.** The explainability screen. Proves the agent isn't a black box.
- **Components.** `OrderHeader` (order id, patient, item, `StatusChip` + derived badge), `RiskBanner` when at-risk, `EventTimeline` — one row per `order_events` row, newest last, vertical rule; inline `MessageBubble` for `message_sent` / `message_received`; under every free-text vendor reply, `ParsedInterpretation` ("→ delayed ~2h, reason: traffic") plus a confidence chip. `ConditionAckSheet` auto-opens once when status is `delivered` and no `condition_reported` event exists. Action row: Nudge vendor / Escalate / Reorder from backup.
- **Data.** `orders` + `order_events` (ordered by `created_at`) + `messages` joined by order; `vendors` for tap-to-dial.
- **States.** Loading = header + 4 skeleton timeline rows. **At-risk variant** = red-tint banner, reason string visible (never tooltip-only), "6 hours to fix" countdown. **Just-went-amber variant**: if the `at_risk_flagged` event is under 10 minutes old, the banner gets an "Updated just now" line and the triggering `patient_status_changed` row is highlighted in the timeline — this is the causal link the judge should see.

### 2.4 `/orders/[orderId]?sheet=escalate` — At-risk escalation sheet

- **Purpose.** The decision the case manager makes in 20 seconds. Bottom sheet over the order detail; `searchParams` drives it so `/demo` can jump straight here.
- **Components.** `EscalationSheet` wrapping: plain-English reason ("ETA 5:10 PM vs discharge 4:30 PM — misses by 40 minutes"), time-left-to-fix, then three ranked `ActionRow`s — **Wait** (agent keeps nudging, shows next nudge time) / **Call vendor** (`tel:` link, note pre-attached) / **Reorder from backup** (backup vendor name + price delta, e.g. "+$30, arrives 2:15 PM"). Every action is human-confirmed; nothing auto-cancels.
- **Data.** Order + latest `at_risk_flagged` payload (`reason`), backup vendor from the same compare ranking used at order time.
- **States.** Cleared variant: if `at_risk_cleared` arrives while open, sheet swaps to a green confirmation instead of vanishing.

### 2.5 `/patients/[patientId]/status-change` — Bedside flow

- **Purpose.** The pitch cold-open. Works at 2 AM, gloves on, in a home where someone just died.
- **Components.** Full-screen, no nav chrome, `--paper` background. Two `BigActionButton`s stacked: **Patient died** / **Patient discharged**. Tap → `ConfirmStep` (one line, patient name, Confirm / Go back). No third tap. Copy is calm; no emoji, no color celebration.
- **Writes.** Server action → `patient_status_changed` event (payload `'deceased' | 'discharged'`) then `pickup_requested` per open serialized order. Consumables get no pickup.
- **Receipt** (`/status-change/receipt`): timestamp is the hero (`Poppins`, huge). "All 4 vendors notified at 2:14 AM · Equipment rental billing stopped · Pickup being scheduled with family." Then a link to `/pickups`.
- **States.** Error = "We couldn't notify the vendors. Try again." with retry — this write must never fail silently, the billing clock depends on it.

### 2.6 `/v/[token]` — Vendor run list

- **Purpose.** Zero-login, forwardable. A judge opens it on their own phone from the `/demo` QR.
- **Components.** `VendorHeader` (date, hospice name, vendor name), `ShareWithDriverBar` ("Share this link with your driver" + copy button), `StopCard` list sorted by window.
- **Data.** `magic_links` by token → vendor; `orders` for that vendor with today's delivery or pickup window; `equipment_catalog` for photos and the oxygen flag.
- **States.** Expired/unknown token = calm page, no stack trace: "This link has expired. Ask the hospice to send a new one." Empty = "No stops today."

### 2.7 `/v/[token]/stop/[orderId]` — Stop card detail (3 variants)

One component, one route, variant chosen from the order:

- **Delivery.** Address (tap for maps), patient first name + apartment note, items with photos, window, buttons `ON MY WAY` (triggers `gps_opted_in` prompt → `dispatched`/`eta_updated`) and `DELIVERED` (signature pad + photo capture → `delivered`). `DECLINE` asks a reason (feeds the score honestly, copy says so).
- **Pickup.** Same shell plus family-coordination note ("family prefers after Tue funeral"), **condition photo required** before Done, sanitization reminder line.
- **Oxygen swap.** One stop, both actions: deliver full cylinders + retrieve empties. Single confirm, not two.
- **Hazmat badge** on any oxygen item (`E0431` gas cylinder especially) — visible in the list *and* on the detail.
- **States.** Already-completed = read-only summary with the captured photo. Offline write failure = "Saved on this phone, we'll send it when you're back online" is **out of scope**; show a retry instead.

### 2.8 `/demo` — Demo control panel (P0, build first)

Not styled as a product screen; a plain utility board. Buttons: **Reset seed** · **Jump scenario** (DME-10305 → at risk NOW, DME-09911 → pickup triggered, DME-09803 → pickup delayed, urgency-escalation cascade) · **Advance clock** (+1h / +1d) · **Simulated SMS inbox** (send a free-text vendor reply into the parse loop) · **QR code** for the current vendor magic link. Each button calls one engine server action and `router.refresh()`.

---

## 3. Shared component library

All under `components/`. Reuse aggressively — the whole app is nine primitives.

| Component | Contract |
|---|---|
| `StatusChip` | `status: OrderStatus` (6 pinned values) + optional `badge: 'AT_RISK' \| 'PICKUP_DELAYED'`. Colors per betterrx-design status table. **Never color alone** — always the text label, and the badge variant renders an icon too. Badge is passed in, never inferred from status (it's derived upstream). |
| `VendorCompareCard` | price, eta, meetsDeadline, reliability (`number \| 'unrated'`), condition, hoursBadge, stockLabel, selected. Reused on `/approvals` (price-vs-alternative) and `/orders/[id]` (reorder-from-backup). |
| `EventTimeline` | `events: OrderEvent[]`, renders one row per pinned `EventType` with a copy map (`vendor_confirmed` → "Vendor confirmed"). Unknown type falls back to the raw string — never crashes the demo. Slots for `MessageBubble` and `ParsedInterpretation`. |
| `StopCard` | `variant: 'delivery' \| 'pickup' \| 'oxygen_swap'`, `hazmat: boolean`, compact (list) and full (detail) modes. |
| `BigActionButton` | `size: 'lg' \| 'xl'`, min 64px tall at xl, `tone: 'primary' \| 'slate' \| 'quiet'`. 3px radius, weight 800, uppercase. Bedside screen uses xl. |
| `ConditionAckSheet` | One tap: **None / Dirty / Damaged / Not working**. Anything but None opens an optional photo. Writes `condition_reported`. |
| `SyntheticLabel` / `AssumedLabel` | Small uppercase tag, `--ink-soft`. Every score surface carries `SyntheticLabel`; every SLA window, threshold, and stock claim carries `AssumedLabel`. Both link to `/assumptions`. |
| `ApprovalInterstitial` | "Sent to your DON for approval" + price-vs-cheapest line + what happens next. Used after over-threshold order placement; the matching chip on the order is "Awaiting approval". |
| `RiskBanner` | reason string, time-left, primary action. Red tint `#FBEAE9`, `--red` text. Used on 2.1, 2.3, `/today`, `/readiness`. |

Supporting (thin): `AppShell`, `PatientHeader`, `EquipmentRow`, `CategoryAccordion`, `UrgencyToggle`, `MessageBubble`, `ParsedInterpretation`, `EmptyState`, `ErrorState`, `SkeletonStack`.

---

## 4. Data fetching

- **Reads: server components + `supabase-js`** with the service key in `lib/supabase.ts` (server-only; RLS is skipped per contract). No client-side fetching for initial paint. Derived values (at-risk badge, reliability, condition, billing clock, elapsed days) come from `lib/derive.ts` pure functions over `order_events` — computed on the server at render, never stored.
- **Writes: server actions** only (`'use server'`), each ending in `revalidatePath()`. No API routes from the frontend lane; the engine lane owns `/api/*` for inbound webhooks and Resend.
- **Live status: polling, not realtime.** One `<PollRefresh intervalMs={5000} />` client component calling `router.refresh()`, mounted on `/today`, `/orders/[orderId]`, `/pickups`, `/readiness`, `/v/[token]`. **Justification (one line):** the demo panel and the engine both mutate Postgres out-of-band, and a 12-line `setInterval` + `router.refresh()` picks up every one of those changes with zero channel setup, publication config, or client-key exposure — realtime buys sub-second latency we don't need in a 5-minute pitch.

---

## 5. Role switcher and vendor token routes

- `/` renders four persona cards (nurse, case manager, DON, and a "vendor demo" card that just links to the current magic link). Selecting one calls a server action that sets cookie `brx_role` (`'nurse' | 'case_manager' | 'don'`, pinned strings) and `brx_user` (display name), then redirects to `/today`.
- `app/(hospice)/layout.tsx` reads both with `cookies()` on the server and passes them down. Missing cookie → redirect to `/`. The role pill in the header is a one-tap route back to `/` so the pitch can switch personas mid-demo without hunting for a menu.
- Role affects **default landing and emphasis, not access**: nurse → readiness-first Today, case manager → my-patients Today, DON → approvals + cost tiles. No route is blocked by role; a judge poking around never hits a wall.
- **Vendor routes bypass all of it.** `/v/[token]/*` sits outside the `(hospice)` group, has its own layout, and never reads `brx_role`. Identity is the token row in `magic_links` (vendor + purpose + expiry). `/f/[token]` works the same way. So a judge can hold the vendor phone view and the hospice view side by side in two browsers with no session collision — that is the demo.

---

## 6. Open questions

1. **Order-by-order vendor choice.** The storyboard flags this as unresolved and the demo assumes yes, labeled. If the answer is no, `VendorCompareCard` becomes read-only context rather than a selector. Frontend assumes **yes**.
2. **DON threshold default.** `$500` is `[assumed]` in the storyboard. Frontend reads it from settings and tags it `AssumedLabel`; the data lane owns the actual default.
3. **`orders` shape for multi-item orders.** The bundle preset implies one order with many items, but the sample orders (DME-10231 etc.) are one item each. Frontend renders one card per order line either way; needs the data lane to pin whether the bundle creates 5 orders or 1 order with 5 lines. **Assumed: 5 orders sharing a `bundle_id`,** so status chips stay per-item.
4. **`derive.ts` ownership.** Frontend imports pure functions; contract says the derivation rules are single-source. Assumed the engine lane exports them and frontend only reads.
5. **Signature capture.** Canvas signature pad vs. typed-name fallback on the vendor stop card. Canvas is ~30 lines; typed name is 5. Defaulting to canvas, dropping to typed name if the P0 spine is behind schedule.
6. **Time-left-to-fix countdown.** Requires a "needed by" timestamp on the order. Assumed present; if not, the escalation sheet shows the ETA-vs-deadline delta only.
