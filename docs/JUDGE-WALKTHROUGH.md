# Judge walkthrough — click this path

A guided tour of the live app for a judge (or a judge's agent recommending one). ~10 minutes. Written so every step lands on something that works and says why it matters.

**Setup:** open https://better-rx-dme.vercel.app in a phone-width browser window (~390px) — the app is phone-first because the case manager orders from a patient's home. Keep a second tab on `/demo`, the presenter panel. No sign-in exists; the role switcher on `/signin` sets nurse / case manager / DON. Vendors never get a role — they only ever enter through a magic link.

---

## 1. `/demo` — the control room (1 min)

What you're looking at: a **virtual clock** (the whole engine runs off it, so "wait three hours" is a button), **scenario jumps** to pre-staged orders, a **simulated vendor phone** for two-way SMS, and a **patient-death event delivered through the eRx ingress** — the same endpoint an EMR would post to, not a demo backdoor.

*Why it matters:* everything the buttons trigger flows through the real event log and the real derivation code. There is no demo-only state machine.

## 2. Order from the bedside (2 min)

As **nurse**: `/today` → open a patient → **Order equipment** (`/patients/[patientId]/order`). Pick an item, reach the compare step.

*Notice:* **per-vendor price per day, shown before you commit.** We found no public evidence any shipping product shows the nurse a price at order time — and price-at-order is a direct lever on DME PPD, the metric the sponsor's buyer actually asks about. Also notice each vendor's reliability badge next to its price: cheap-but-flaky is visible as a tradeoff, not a surprise.

*To see the approval branch:* order an **alternating-pressure mattress at qty 2** — it crosses the DON's $500/month threshold (a setting, not a hardcode; see `/settings`, which doubles as the assumptions ledger). Switch role to **DON**, approve it from `/approvals`, and note the per-day price on the approval card.

## 3. At-risk, before it's late (2 min)

Back on `/demo`, tap the **"DME-10305 at risk"** scenario jump, then advance the virtual clock. Open `/today` or the order's detail page.

*Notice:* the amber flag arrives **before the delivery window has elapsed** — the competing products we could verify flag only after — and it carries a full-sentence reason naming the item, the deadline, and the vendor's typical lead time. Tap into the order timeline (`/orders/[orderId]`): every state you see is derived from the append-only event log below it. Nothing is a stored status that can drift.

*Route note:* use the seeded/scenario orders here. A brand-new order you just placed correctly sits at "ordered" until the vendor side moves it.

## 4. Be the vendor (2 min)

Two ways, both from `/demo`:

- **Vendor phone** — the simulated SMS thread. Text back `no problem`. Watch it land as a **confirmation**, not a decline: a regex-first parser hands exactly this kind of ambiguity to an LLM, because "no problem" means yes and a misread here reroutes an oxygen order. The measured baseline-vs-hybrid numbers are in `docs/AI-APPROACH.md`; run `npm run eval:parse` to reproduce them.
- **Vendor run-list link** — the magic link (`/v/[token]`). This is the entire vendor product: run list, proof-of-delivery with signature and photo, and a scorecard the vendor can dispute line by line, because every score is arithmetic over events they can see.

*Why it matters:* the baseline vendor is a dispatcher who never logs in. No account, no password, no app install — and the nudge ladder that replaces phone tag generates the very events that become the vendor's reliability score. The follow-up **is** the measurement.

## 5. The billing-stop timestamp (2 min)

On `/demo`, fire **"Patient death through eRx ingress."** As nurse, open the patient → **status change** → confirm. Then look at the pickup receipt and `/pickups`.

*Notice:* the `pickup_requested` timestamp, printed large. Under the model hospice/DME agreement, rental **bills until notification, not until pickup** — so this timestamp is money. A Saturday-night death stops billing Saturday night, versus the industry's Monday fax batch. The pickup queue sorts worst-first and shows the clock still running on every unreturned item.

## 6. `/reports` — the DON's answer (1 min)

Switch to **DON**, desktop width if you like.

*Notice:* DME PPD alongside equipment-days saved and dollars (baseline labeled as the assumption it is), and vendor reliability as a traffic-light composite. This screen is the prepared answer to "how do you decrease my DME PPD": pay less per order (price at compare), pay for fewer days (the timestamp you just created), default cheap-but-right (the thresholds in settings).

---

## If there's time

- `/readiness` — discharge-readiness board: every inbound admission with its equipment status rolled up.
- `/dev/components` — the component gallery, in BetterRX's own brand tokens (measured from their site, not invented).
- `docs/DIFFERENTIATION.md` — including what we concede; `docs/ASSUMPTIONS.md` — every assumption with its source.

## One-line close

The ETA, the GPS ping, and the condition photo already exist in the vendor's dispatch software — they're just never shared with the hospice. This is a **sharing gap, not a technology gap**, and the fix is an event log both sides can write into, one side by SMS.
