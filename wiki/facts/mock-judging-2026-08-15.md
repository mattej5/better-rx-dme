# Mock Judging — 2026-08-15, ~90 min before pitch

Adversarial scoring pass against the official rubric. Method: read `docs/bounty/bounty-brief.md` fresh (Required Features + Judging tabs), then clicked the live app at `https://better-rx-dme.vercel.app` as nurse / case_manager / don / vendor. Read-only: no orders placed, no patient status changed, no DB writes.

Claim labels: **[verified]** = I loaded the screen or read the file. **[inferred]** = follows from what I read. **[assumed]** = my judgment call.

**Weighted total: 8.6 / 10.**

| Bucket | Weight | Score | Contribution |
|---|---|---|---|
| Differentiation | 30% | 9 | 2.70 |
| Core user problems | 25% | 8 | 2.00 |
| Architecture / integration-readiness | 15% | 9 | 1.35 |
| AI ROI | 15% | 9 | 1.35 |
| UX and intuitiveness | 15% | 8 | 1.20 |
| **Total** | | | **8.60** |

---

## 1. Differentiation — 9/10 (30%)

### What earns points

- **The vendor sees their own scorecard, and it is the same number the DON sees.** `/v/demo-run-list-v1-2026/scorecard` renders Ridgeline at Reliability 90 / Condition 86, fully decomposed (`On-time delivery 87 × 35%`, `From 15 orders`), with "A dispute you win drops out of the math entirely" and a **Fix first** coaching line. `/reports?tab=vendors` as DON shows Ridgeline at **90 / 86 — identical**. **[verified]** Two-sided transparency on the same arithmetic is the strongest single thing in this build and nothing in `competitor-products.md` claims it.
- **Vendor cold-start is actually built, not sketched.** `/v/[token]/welcome` is a two-screen, no-password, no-install equipment-and-coverage intake: "Nothing to install, no password. Hospices see what you stock and only send you orders you can fill." **[verified]** The brief names vendor recruitment from a cold start as the hardest required feature; most teams will hand-wave it.
- **The run list is cross-hospice by construction.** `/v/demo-run-list-v1-2026` interleaves **Mesa Grande Hospice** and **Desert Valley Hospice** stops on one driver's list, earliest-first. **[verified]** That is the visual proof of the multi-tenant claim in `ASSUMPTIONS.md` #7, and it is the vendor's actual value prop (one list, not one portal per hospice).
- **Predictive, not elapsed, with a legible reason.** Every flag carries a plain sentence: *"Oxygen concentrator, no ETA yet. 4 hours to the 1:41 PM discharge; this vendor typically needs 4 hours plus a 2-hour safety buffer for high-risk equipment."* **[verified]** The high-risk buffer visibly moves oxygen amber before a bed on the same clock. This directly satisfies the brief's "Explainability" differentiator bullet.
- **Price before the tap.** `/approvals` shows `$8.33/day total` and `$2.00/day more than ValueCare DME`; the escalate sheet's backup option shows `ValueCare DME · -$0.21/day · ready in about 38 hours`. **[verified]**
- **`DIFFERENTIATION.md` pre-concedes Qualis on mobile ordering and multi-vendor selection and strikes them from the claim list.** **[verified]** A judge who was going to catch that now cannot.

### What a skeptical judge docks

- **The at-risk board cries wolf.** `/today` "Needs attention" holds 8 rows; **three are the same Evelyn Brooks overbed table** (two vendors, timestamps 9:37 and 9:39), and one of those orders already reads `Replaced by order DME-10309-R1` on its detail page yet still sits on the board flagged. **[verified]** `/readiness` escalates the same thing to a red **"Discharge blocked risk"** banner — for an overbed table. If everything is at risk, the flag stops meaning anything, and that undercuts the central differentiation claim.
- **The headline financial number is $70.72.** `/reports?tab=saved` reads `14.1` rental days avoided / `$70.72` not billed — and shows the **identical figure for Last 30 days, This year, and All time**. **[verified]** A judge reads the triplicate as a broken period filter, then reads $70 as "this saves nothing."
- The "we found no public evidence" framing is honest but invites *"so you don't actually know."* **[assumed]**

### Say or show in the pitch

Put the **vendor scorecard next to the DON vendors tab on one screen** and say: *"Same number, both sides, formula printed, and the vendor can dispute a line. Every product in this space scores the vendor privately or not at all."* Then follow with the `/welcome` screen: *"That vendor onboarded in two taps, no account, no app."*

---

## 2. Addresses core user problems — 8/10 (25%)

### What earns points

- **All three sponsor scenarios are live, not slides.** Discharge readiness = `/readiness`, item-by-item per patient with On track / Due soon / At risk / Not ordered. Post-death pickup = `/patients/[id]/status-change` → two big buttons (`PATIENT IS DECEASED` / `PATIENT DISCHARGED`) with a second-step confirm sentence before `NOTIFYING VENDORS` (`status-change-flow.tsx:64,72`) **[verified]**, then a receipt page that re-derives the timestamp from the event log so a refresh shows the same number **[verified, source]**. Service-failure prevention = the escalate sheet.
- **The escalate sheet is the best-designed screen in the build.** `/orders/[id]?sheet=escalate` offers WAIT / ESCALATE TO DON / REORDER FROM BACKUP, each with a one-line consequence, and closes with **"Nothing is cancelled automatically. You choose."** **[verified]** That is exactly the sponsor's "grandmother's least technical friend" bar.
- **`Synced from HCHB` / `Synced from Axxess` chips on patient rows** make the integration story visible inside the product, not just in a doc. **[verified]**
- **Phone-first is real**: 430px column, bottom tab bar (Today / Patients / More), oversized primary actions. **[verified]**

### What a skeptical judge docks

- **`/pickups` 307-redirects to `/patients?show=pickups`** **[verified]**, and on that tab the status chip shows the *order* status, not the pickup status — so a judge reads `Dorothy Nguyen · Pickup open 0 days · **Delivered**` and `Arthur Bell · Pickup open 0 days · **Ordered**`. **[verified]** The pickup tracker is a named required feature; presenting it as a filtered patient list with a mismatched chip undersells the single most emotionally loaded moment in the brief.
- **The pickup hero case is 98.9 hours overdue.** `James Wilson … pickup was requested 98.9 hours ago … the 48-hour pickup window has passed.` **[verified]** It demonstrates the alert, but it also demonstrates four days of the system alerting and nobody acting. **[inferred]**
- The at-risk reason string says **"discharge"** even on `admission`-urgency orders (`src/lib/rules.ts:281-282`), so Evelyn Brooks reads as *admitted Monday* and *"23.9 hours to the 9:37 AM discharge"* on the same journey. **[verified]**

### Say or show in the pitch

The bedside death tap, end to end, on the phone: two buttons → confirm → **receipt with the timestamp**. Then say the sentence that turns UX into money: *"Under the model hospice/DME agreement rental stops at the earlier of notification or pickup. Today that notification is a Monday batch list. That timestamp is the artifact."*

---

## 3. Architecture and integration-readiness — 9/10 (15%)

### What earns points

- **One ingress, one envelope.** `POST /api/erx/events` is the only door; `GET` correctly returns **405** **[verified]**. `external_id` idempotency, `account.identifiers → hospice_account` tenancy mapping, append-only `order_events` as the spine, `derive.ts` as pure read-side, `rules.ts` appending back into the log. **[verified, `docs/INTEGRATION.md`]**
- **The demo panel uses the production path.** `/demo`'s death simulation says *"Posts to `/api/erx/events`, the live eRx ingress endpoint. Press again to demonstrate the replay no-op."* **[verified]** Demonstrating idempotency by pressing the button twice is a strong, cheap architecture beat.
- **HCHB adapter is a typed stub with no runtime deps**, and the mermaid diagram in `INTEGRATION.md` satisfies deliverable D literally ("a diagram is enough"). **[verified]**
- **The provider seam paid off in public.** `AI-APPROACH.md` §4 documents swapping Anthropic → MiniMax M3 via `ANTHROPIC_BASE_URL`/`PARSE_MODEL` with nothing above `parseVendorReply()` moving, *and* reports the failure it surfaced (the gateway silently ignores `output_config` / `cache_control`). **[verified]** Admitting a seam defect is more credible than claiming the seam is clean.
- Desktop is handled deliberately: `wide-column.tsx` breaks `/approvals` and `/reports` out to 1080px at `lg` while every other route stays in the 430px phone column. **[verified]**

### What a skeptical judge docks

- **RLS off, service-role key, no auth.** Stated openly in `ASSUMPTIONS.md` #2 **[verified]**, which is the right posture, but a healthcare judge will still register it.
- Multi-tenancy is one seeded account, `ACCT-001`. The run list *looks* cross-hospice; the isolation is not enforced. **[inferred]**
- `/demo` carries **four visibly dead controls**: `Reset seed (stub) — Not wired up yet`, `Scenario jumps (stub) — Scenario replay is not landed yet; these buttons are honest stubs`, and an `Inline SVG placeholder` where the QR code should be. **[verified]** Honest labeling is good repo hygiene and bad stagecraft.

### Say or show in the pitch

Press the death simulation **twice** on `/demo` and say: *"Same endpoint an EMR posts to, same envelope, and the second press is a no-op because idempotency is keyed on `external_id`. That is the whole integration risk, handled at the door."*

---

## 4. AI ROI — 9/10 (15%)

### What earns points

- **The confidence gate is rendered, live, on a real order.** Order DME-10309 timeline: vendor texts *"probably fine on our end, driver reckons sometime late afternoon"* → *"We read this as: delay, reason: driver estimates late afternoon"* → **62% confidence** → **"Nothing was changed on the order. Please confirm."** with **That's right / Not right**. **[verified]** This is the single most defensible AI artifact in the build, because the brief demands exactly it: low confidence flagged instead of stated as fact, human confirm before a state change.
- **A named baseline that was not quietly repaired.** `parseWithRegex()` scores 11/24 *with its errors intact*; the two adversarial failures (`"ok"` → confirm @0.99, `"no problem"` → decline @0.95) are the documented reason short bare acknowledgments are routed past the deterministic tier. **[verified, `docs/AI-APPROACH.md` §3]** "A baseline you quietly repair is not a baseline" is a line worth saying out loud.
- **The correct answer to most of the rubric is "rules," and they gave it.** At-risk flagging, scoring, billing clock, and ladder timing are all deterministic, with a stated reason per row. The brief explicitly blesses this. **[verified]**
- **Cost is answered with the right number.** ≈$0.004/order inference, **Twilio SMS at ≈$0.026/order is 6× that**, and the model choice (Opus 5 over Haiku at 5× less) is defended rather than hidden. **[verified]**
- **Safety is specific**: fixed five-action tool list, 0.75 gate, grounded per-order context, prompt-injection containment argued from the constrained action set. **[verified]**

### What a skeptical judge docks

- **The eval is self-admittedly contaminated** — 24 fixtures and the few-shot prompt written by the same author in the same session. **[verified, disclosed in §3]** Disclosed, but it means 96% measures very little.
- **The demo does not run the model the cost table prices.** Table is Anthropic Opus list; the demo parses through MiniMax M3 on a flat subscription, marginal cost zero. **[verified]** Correctly reported separately, still a "so which is it" moment.
- The AI surface is one function. A judge who wanted AI ROI to mean *more* AI will read 15% of the rubric as barely engaged. **[assumed]** The brief protects against this, so lean on the brief.

### Say or show in the pitch

Show the **62% card**, and say: *"Regex is our baseline and we publish its score with its mistakes in it — it reads 'no problem' as a decline at 95% confidence, and a decline is what triggers a reroute. That failure is why the router exists. Below 0.75 nothing moves; a nurse taps."*

---

## 5. UX and intuitiveness — 8/10 (15%)

### What earns points

- Brand fidelity to BetterRX (Poppins/Inter, salmon, warm paper, 3px uppercase buttons), phone-first 430px shell, bottom nav, plain-language everywhere. **[verified]**
- **`Order bundle` / "Typical admission bundle — Bed, mattress, oxygen concentrator, commode, walker. One tap adds all five."** **[verified]** Exactly right for a first-time user, which per the brief is every user.
- Order step 1 shows **HCPCS E-codes inline** on every item without making the nurse care about them. **[verified]**
- Divide-by-zero handled gracefully: `Arthur Bell · 0 days · $5.00 · **No data**` instead of `NaN` or `∞`. **[verified]**
- Consistent labeling vocabulary: `Default estimate`, `Estimated as monthly price ÷ 30`, `Synthetic patients and addresses`, `Sample scores`, `Lead time and stock are estimates`. **[verified]**

### What a skeptical judge docks

- **The provenance label is missing on exactly the screens where money appears.** `Sample data` is present on `/today` and `/readiness` and absent on **`/reports` (all three tabs), `/approvals`, `/patients`, `/settings`**. **[verified by grep against the live HTML]** `ASSUMPTIONS.md` #3 claims *"a 'synthetic history' label rides every score surface… and the DON dashboard (view 12)."* That claim is **false as shipped**. If a judge reads the doc and then opens `/reports`, the honesty story takes the hit — and honesty is this entry's whole posture.
- **Grammar and spacing bugs on the most-read strings**: `for a admission order` (every admission flag), `1 hours to the 11:14 AM discharge`, `24 order s counted`, `( 100% of 100% )`, `62 %`. **[verified]**
- **Card/reason contradiction**: Walter Kim's card reads `Arrives Sat 11:14 AM` while the flag beneath reads `no ETA yet`. **[verified]** Small, but it is a contradiction on the exact claim the product is selling.
- `/demo`'s stub buttons, if shown on stage. **[verified]**

### Say or show in the pitch

`/readiness` on the phone, one thumb: *"One board, every admission and discharge, item by item. Green, amber, red, and the red one tells you why in a sentence a new nurse can read on her second day."*

---

## The three hardest Q&A questions

**1. "Qualis is hospice-specific, has 12 EMR integrations, mobile nurse ordering, multi-vendor selection, real-time visibility, and auto pickup on discharge. What is actually left for you?"**

Honest answer — and say it before they do: *Ordering is solved and we are not claiming it.* Four things are left. Qualis flags when a window has **already elapsed**; we flag before it, weighted by item and urgency, with the reason printed. Qualis's published answer to a non-responsive vendor is a **managed-service layer** — humans phoning — which costs headcount per order and produces no data; ours is a five-step SMS ladder whose exhaust becomes the vendor's reliability score. Their pickup trigger is tied to **discharge**; ours starts from a death tap at the bedside with a timestamped receipt. And no product we found shows the **vendor** their own decomposed, disputable score. Concede the death-pickup gap is inferred, not verified — they may have shipped it since the page we read.

**2. "Your magic links carry patient initials, full street addresses, hospice names, and equipment — no login, 72-hour expiry, and deliberately re-usable and forwardable. Is that shippable in healthcare?"**

This is the one the build is least prepared for; `ASSUMPTIONS.md` #9 explains *why* the link is forwardable but does not address the PHI exposure. Honest answer: **no, not as-is, and the mitigation is known.** The link is a bearer token over SMS, which is the same trust model as faxing a delivery ticket to a vendor — a real hospice already sends this information to this vendor by less secure means today. For production: shorten expiry, scope the token to a single vendor's stops (already true), strip the address until the stop is opened, log every view, and put it under a BAA with the vendor. What we would **not** do is add a password, because the whole design premise is a dispatcher who will never create an account.

**3. "Your at-risk board flags an overbed table as a 'Discharge blocked risk,' and your headline savings figure is $70.72. Why should we believe the model or the money?"**

Two separate concessions, both honest. On the flag: the rules are working as written but the **thresholds are untuned**, because there is no delivery-timing dataset anywhere to tune them against — every constant is exposed in Settings for exactly that reason, and a real deployment tunes them in week one against that hospice's own vendors. On the money: $70.72 is 13 synthetic orders over a demo window, and the 26-hour phone-and-fax baseline is a labeled assumption with a slider, derived from the model hospice/DME agreement's daily business-day batch-list duty. **We deliberately do not claim a percentage reduction in DME PPD.** We demo the mechanism and the counter, and the mechanism is a contract clause, not a slogan.

---

## Fixable in under 30 minutes, ranked by score movement

1. **Add the provenance label to `/reports` (all three tabs) and `/approvals`.** ~10 min. `components/labels.tsx` already exports `SyntheticLabel` and `AssumedLabel`, and `vendor-compare-card.tsx:172` shows the pattern (`<SyntheticLabel>Sample scores</SyntheticLabel>`). Drop one on the vendors tab, the saved tab, the PPD table, and the approvals list. This closes a **direct contradiction between `ASSUMPTIONS.md` #3 and the shipped app** on the screens a DON judge will stare at longest. Highest ratio of score-per-minute in the list.

2. **Fix the reason-string copy in `src/lib/rules.ts:281-282`.** ~15 min. Three edits to one template: (a) `for a ${urgency} order` → article helper, killing `for a admission order`; (b) pluralize the hours (`1 hours`); (c) the word `discharge` is hardcoded even for `admission` orders — swap to `needed-by time` or branch on urgency. These strings appear on `/today`, `/readiness`, `/orders/[id]`, the escalate sheet, and the vendor run list, i.e. every screen in the demo. Grammar errors on the sentence you are selling as "explainability" cost more than they should.

3. **De-noise `/today`.** ~20 min. Suppress at-risk rows for orders already marked `Replaced by order …` — DME-10309 is superseded and still occupying the board — which alone removes 2 of the 3 duplicate Evelyn Brooks overbed-table rows. If touching the query is too risky this close, the **zero-code fallback** is to not scroll `/today` past the first three cards and to open the story from `/readiness` instead.

**Also, free and instant:** do not put `/demo` on the projector except for the death-simulation double-press. The stub buttons and the `Inline SVG placeholder` where the QR belongs are four visible dead controls; have the raw `/v/...` link ready in a browser tab instead of the QR.

**Explicitly not worth fixing before 2:00 PM:** the identical Last-30/This-year/All-time figures on the saved tab (real seed artifact, but explaining it costs less than fixing it), the `Delivered`/`Ordered` chip mismatch on the pickups tab, and anything touching RLS.
