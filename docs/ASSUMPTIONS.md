# Assumptions Ledger

Every number and shortcut in this build that is not sourced from the sponsor. The sponsor told us they cannot fill these gaps, and that stating them is scored well while hiding them is scored badly `[faq]`. Source tags follow the wiki convention: `[brief]`, `[faq]`, `[kickoff-qa]`, `[research]`, `[team]`, `[assumed]`.

Anything editable at runtime lives in Settings (view 14), which is the in-app version of this file. The engine reads Settings, it never hardcodes.

---

### 1. No DME delivery-window standard exists, so we invented one and labeled it

**Assumed.** SLA windows: STAT same-day, routine within 24 hours, admission before the patient arrives home.

**Why.** BetterRX holds no DME vendor contracts, so a delivery window has never been codified `[faq]`. Industry practice is the stated starting point: same-day for urgent, within 24 hours for routine `[faq]`. Post-death pickup should be "as immediate as possible, within 24 hours" `[kickoff-qa]`.

**Where it surfaces.** Lead-time constants in `src/lib/rules.ts` (`LEAD_TIME.stat` 4h, `.admission` 24h, `.routine` 48h), the countdown on every order card, and the amber/red thresholds on the readiness board. All configurable in Settings.

---

### 2. Row Level Security is off

**Assumed** (demo posture, not a product position).

**Why.** No auth in the build. A role switcher writes `{ role, userName }` to a cookie; vendors never have a role and enter through magic-link token routes. Adding RLS with no real identity would be theater. Pinned in `specs/00-contracts.md`.

**Where it surfaces.** Supabase access runs through the service-role key in `src/lib/supabase.ts`. It is stated on the architecture slide, not hidden. Production would key RLS off `orders.hospice_account` (see assumption 7).

---

### 3. All history and all vendor scores are synthetic

**Assumed**, and forced by the data situation.

**Why.** No delivery-timing or fulfillment data exists in any shareable form. CMS DMEPOS public use files report billing, not logistics `[faq]`. There is no delivery timestamp history for DME at BetterRX either; DME delivery status is a new capability to build, not a feed to consume `[faq]`. Constraint 1 of the bounty is synthetic data only `[brief]`.

**Why it is still honest.** Scores are **computed** from ~70 seeded closed orders, never written as literals. The formula in `src/lib/score.ts` is the same formula that will run on real events from day one.

**Where it surfaces.** A "synthetic history" label rides every score surface: the vendor compare card (view 5), the vendor report card (view 19), and the DON dashboard (view 12). Cold-start vendors show "Unrated," never zero `[team]`.

---

### 4. DON approval threshold is $500

**Assumed.** `don_threshold_cents = 50_000` in `src/lib/settings-defaults.ts`.

**Why.** No sponsor number exists; it is on `wiki/facts/open-questions.md`. $500 separates a wheelchair from a hospital bed cleanly enough to demonstrate the branch. Guardrails and approval thresholds are the sponsor's own cost playbook on the pharmacy side `[faq]`.

**Where it surfaces.** `placeOrder` emits `approval_requested` instead of `vendor_notified` above the threshold. The DON approval queue, the "Awaiting approval" chip, and the Settings slider. STAT orders above the threshold still require approval, and the screen says so.

---

### 5. `price_cents` is a monthly rental, daily rate is `/30`

**Assumed.** Ratified amendment 11 in `specs/00-contracts.md`; `ASSUMED_DAYS_PER_MONTH = 30` in `src/lib/domain.ts`.

**Why.** Hospice DME is rented under a private per-item contract with the supplier, billed to the hospice out of the Medicare per-diem, not to Medicare `[research]`. We had no per-day price source, and 30 is the conventional divisor. Seed prices are invented spreads, not CMS PUF-derived.

**Where it surfaces.** Price shown per vendor at order time (view 5) and every dollar figure in the equipment-days-saved counter (view 12). The `/30` is printed in the footnote beside the number.

---

### 6. Baseline notification lag is 26 hours

**Assumed**, and the single most load-bearing number in the build. `baseline_notify_lag_h = 26`.

**Why.** The model hospice/DME agreement stops rental billing at the earliest of the date the hospice notifies the supplier or the date of actual pickup, and it puts the hospice's notification duty as a **daily business-day batch list** `[research]`. A Saturday-night death does not reach the batch list until Monday. 26 hours models that gap. No measured post-death pickup delay distribution exists anywhere `[research]`.

**Where it surfaces.** `daysSaved = max(0, (26 - notificationLagHours) / 24)` in the billing clock. The DON "Saved" tab prints the assumption label beside the dollars and exposes the number as a slider. If a judge pushes, the honest answer is the contract clause plus the slider, not a defended figure.

---

### 7. Single hospice account, multi-tenancy is stated rather than built

**Assumed.** One seeded `hospice_account`, `ACCT-001`.

**Why.** The real eRx envelope carries `account.identifiers[0].id` `[faq]`, so the tenancy key exists in the record shape. Wiring per-tenant isolation in 24 hours would consume time the rubric does not reward.

**Where it surfaces.** `orders.hospice_account`, populated from the envelope by `POST /api/erx/events`. The demo panel's simulated death event sends `ACCT-001`. Documented in `docs/INTEGRATION.md` as an explicit gap, not a silent one.

---

### 8. One hospice timezone, `America/Denver`

**Assumed.** Seeded into `settings`; `HOSPICE_TIMEZONE` in `src/lib/domain.ts`.

**Why.** A vendor texting "3pm" carries no timezone. Resolving that correctly requires a per-order timezone and a per-vendor one. Multi-timezone parsing is out of scope for a 24-hour build.

**Where it surfaces.** Every rendered time, and the timezone rule inside the `parseVendorReply()` system prompt. A relative ETA ("in 45 min") is unaffected.

---

### 9. Vendor participation is taken as given

**Not our assumption, a bounty rule.** Vendor network building is explicitly out of scope `[faq]`.

**Why it still shapes the build.** BetterRX has zero owned DME vendor relationships today, so whatever we build has to create value before a single vendor relationship exists `[brief]` `[faq]`. That is why the baseline vendor is someone who never logs in and only answers an SMS or taps a magic link, copied from the Trucker Tools "Text to Track" mechanic `[research]`.

**Where it surfaces.** Vendor routes are all `/v/[token]`, no account, no password, 72-hour expiry, deliberately not single-use so a dispatcher can forward the link to a driver.

---

### 10. Live vendor inventory does not exist, and we designed the socket anyway

**Assumed**, on sponsor instruction.

**Why.** A live inventory API is unlikely to exist in practice, but the sponsor asked that the ordering flow be architected so a real-time check can slot in later with a graceful fallback to price and service-based selection. Forward-compatible design is what they said they value most in judging `[faq]`.

**Where it surfaces.** `vendors.inventory` is a column the compare step reads. When it is null the compare card ranks on price, hours, coverage, and equipment match instead, and the card says which mode it is in. The swap-in point is labeled in `docs/INTEGRATION.md`.

---

### 11. Pickup thresholds of 24h amber and 48h red have no published source

**Assumed.** `pickup_amber_h = 24`, `pickup_red_h = 48`.

**Why.** No published pickup SLA benchmark exists. The 24 and 48 hour figures circulating in the industry are contract-negotiation advice, not a standard `[research]`. The sponsor's own preference is "as immediate as possible, within 24 hours" `[kickoff-qa]`.

**Where it surfaces.** Rule R5 `pickup_delayed` and the elapsed counter on the pickup tracker. Both configurable, both labeled on screen.

---

### 12. Confirmation-silence windows are invented

**Assumed.** 30 minutes for STAT, 2 hours for admission, 8 hours for routine.

**Why.** No vendor interviews were conducted, so dispatch and driver logistics are unknown `[faq]`. Vendors staff business hours while hospice deaths and crises are 24/7; the sponsor's own words are "Nationals only work Monday through Friday, nine to five" `[brief]`, which is structural support for a short window, not a measurement of one.

**Where it surfaces.** Rule R3, and the nudge ladder step timings, which are multiples of the same constant (0.5x, 1.0x, 1.5x, 2.0x, 2.5x).

---

### 13. The escalation ladder is borrowed evidence, not DME evidence

**Assumed** for DME, `[research]` for the underlying effect.

**Why.** A 21-study meta-analysis (n=16,076) found multiple SMS notifications produce RR 1.49 versus RR 1.09 for a single notification `[research]`. That is attendance behavior in a healthcare setting, not DME dispatcher behavior, and it was not validated on low-tech populations specifically. We use it to justify a ladder over a single retry, not to predict a response rate.

**Where it surfaces.** The five-step nudge ladder in `src/lib/rules.ts`. Every step is a `message_sent` event with `payload.kind='nudge'`, so ladder state is derived by counting and stays idempotent under repeated clock advances.

---

### 14. High-risk item definition is ours

**Assumed.** `unit_price_cents >= 40000` OR `time_critical = true`.

**Why.** A bed arriving late is uncomfortable. Oxygen arriving late is a clinical event. Nobody published that line, so we drew it and we say we drew it. Time-critical seeds: E1390, E0431, E0601, E0470, E0600.

**Where it surfaces.** `HIGH_RISK_BUFFER` of 2 extra hours in rule R4, which is why oxygen goes amber before a bed does on the same clock. Visible in the flag's reason string.

---

### 15. Scoring has no recency decay

**Assumed.** All seeded history weighs equally.

**Why.** A real system would use a rolling 90-day window. Implementing decay adds a knob without changing the demo.

**Where it surfaces.** Stated on the vendor report card. Listed in `specs/data.md` open questions.

---

### 16. Family contact data is present on the patient record

**Assumed.**

**Why.** The real EMR mapping for a family contact is in the integration sketch, not built. Note that family-facing comms were cut from v1 anyway (team decision, 8/14 late), so this assumption is currently dormant rather than load-bearing.

**Where it surfaces.** `docs/INTEGRATION.md` record shape only. No family message is sent in the demo.

---

## What we deliberately did not assume

- **No claimed percentage reduction in DME PPD.** We demo the mechanism and a synthetic counter. AI ROI is judged on approach and honesty about the baseline, not on measured accuracy, because there is no held-out dataset `[faq]`.
- **No claim that competitive bidding harmed patient access.** GAO explicitly did not find beneficiary-access harm `[research]`. Our claim is coordination fragility.
- **No claim that CAHPS measures equipment.** The instrument contains no equipment question `[research]`. The anchor item is Q6, on whether the team let the family know when they would arrive.
- **No use of Medicare Part B capped-rental "full month on death" rules.** They do not apply to hospice DME `[research]`. Conflating them is a checkable factual error.

## Added 8/15 (product review)

**Staff management is out of app scope.** Adding or removing hospice personnel is an identity-system concern (BetterRX identity, EMR roster sync), not a feature of this app. The DON is the in-app administrative persona: approvals, vendor management, guardrails. Surfaces: /signin persona roster, /approvals, /settings. [assumed]

**Single-hospice seed, multi-hospice architecture.** One hospice account is seeded and labeled. Vendor magic links are vendor-scoped, orders carry hospice_account, so a vendor's run list is cross-hospice by construction; the demo simply has one tenant's data. Surfaces: vendor run list, /api/erx/events tenancy mapping. [assumed]
