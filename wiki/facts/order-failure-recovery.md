# Order Failure Recovery & Fallback Plan

When a vendor cannot fulfill an order (damage, stockout, route failure), the system must help the hospice recover in minutes, not hours. This scenario is a core proof of differentiation: visibility and speed. `[assumed]`

---

## The Scenario

**Wednesday 3 PM.** Mr. Chen's wheelchair (E1130) is en route for Thursday 1 PM arrival, discharge 2 PM. Vendor dispatcher calls their routing center: wheelchair damaged in transit, cannot be repaired in time.

**Problem today:** Hospice finds out Thursday morning or doesn't find out until discharge is delayed. Wheelchair isn't there. Patient goes home without equipment. Hospice blamed.

**With app:** Sarah gets an alert within 3 minutes. She re-orders from an alternative vendor. New ETA confirmed. Family notified `[cut 8/14 — family comms out of demo scope]`. Crisis averted.

---

## Critical Features (MVP)

### 1. **Failure Signal (Vendor → System → Hospice)**
- Vendor updates order status to **"Unable to Fulfill"** with reason (damage, stockout, logistics failure, etc.)
- System receives update **within minutes** via webhook/API callback (not batch nightly)
- Sarah's phone receives **high-priority alert** (visual + buzz, not silent): *"URGENT: [Equipment] order cannot be fulfilled. Discharge [date/time]. [Hours] to re-order."*
- Alert includes:
  - Order ID and equipment type
  - Reason for failure
  - Remaining time before deadline
  - "View alternatives" button

**Why this matters:** Every minute lost increases the chance of discharge delay. Sync callback is non-negotiable.

---

### 2. **Instant Alternative Search (Pre-Fetched)**
On order failure, system automatically queries all other vendors for:
- Same equipment type (exact HCPCS code match)
- Stock status (in stock right now, not backorder)
- ETA (when can it be delivered, does it beat the deadline)
- Price (for comparison)
- Ranked by **ETA first, then price**

Display alternatives in a table:
```
| Vendor | Equipment | Price | Stock | ETA | Action |
|--------|-----------|-------|-------|-----|--------|
| Vendor B | E1130 wheelchair | $200 | ✓ | Thu 12 PM | [Re-order] |
| Vendor C | E1130 wheelchair | $220 | ✓ | Thu 11 AM | [Re-order] |
```

**Why this matters:** Sarah doesn't have to call 3 vendors and wait on hold. Options are ranked by her most urgent decision factor (will it get there in time?). Speed to action: < 30 seconds.

---

### 3. **One-Tap Re-Order (Copy Fields, Swap Vendor)**
- Sarah taps "Re-order with Vendor C"
- New order pre-fills with all original fields (patient, equipment type, quantity, urgency, deadline)
- Only field that changes: vendor
- One confirmation tap → order placed
- **No form re-entry. No re-describing the situation.**

**Why this matters:** High cognitive load + time pressure = mistakes. Copy-and-swap eliminates friction and errors.

---

### 4. **Vendor Notification (Instant, Not Voice Mail)**
When Sarah confirms the re-order:
- **Vendor C receives notification within seconds** (SMS + email, vendor preference)
- Message includes: patient ID, equipment type, needed-by date/time, hospice contact, order ID
- **No phone tag.** Vendor can immediately update their system and dispatch.

**Why this matters:** Async communication (SMS + email) is faster and more reliable than phone tag, especially during high-demand periods.

---

### 5. **Family Auto-Notify (If Enabled)** `[cut 8/14 — family comms out of demo scope]`
Once re-order is confirmed:
- **SMS/email to patient's family:** *"Your wheelchair order was delayed. We have rescheduled delivery for Thursday morning. Equipment will still arrive before discharge. We apologize for the inconvenience."*
- Message is pre-written but can be edited by Sarah before sending
- **Tone:** Proactive, not defensive. Hospice looks like they solved it, not like they're scrambling.

**Why this matters:** Families are reassured and don't call the hospice asking where the equipment is. Reduces noise, protects reputation.

---

### 6. **Fallback Chain (If No Exact Match Available)**
If no other vendor has the exact equipment in time, system suggests:
1. **Alternative equipment** that solves the same problem (e.g., if no E1130 wheelchair, show E1090 bed that can be used for positioning)
2. **Loaner inventory** (if the hospice maintains one) — *"Hospice has 1 loaner wheelchair available. Can loan for 2 days."*
3. **Escalation to DON/Dispatch** — *"No vendors have stock. DON approval needed for next steps."*

**Why this matters:** Rare cases exist where no good alternative is available. The system should guide Sarah to human escalation, not just give up.

---

### 7. **Cannot-Resolve Escalation (Last Resort)**
If **no alternative exists** and discharge is imminent:
- Order flagged as **"Cannot Resolve"** (red badge on DON dashboard)
- Suggested actions appear:
  - "Contact [primary vendor's] dispatch center directly at [number]" (link to call)
  - "Recommend discharge delay until [updated ETA]" (notification template for physician)
  - "Check if hospice has loaner equipment" (inventory lookup)
  - "Document outcome for vendor performance scoring"
- **Track what actually happened** — Was discharge delayed? Was a loaner used? This data feeds vendor performance and informs future vendor selection.

**Why this matters:** Transparency. The hospice sees that the system tried everything, escalation was documented, and outcome is recorded. No surprises at discharge time.

---

## Design Principles

| Principle | Application |
|-----------|-------------|
| **Speed over perfection** | Show alternatives in 3–5 seconds, even if the list is incomplete. Sarah needs to act now. |
| **Async over sync** | SMS + email to vendor, not waiting for a phone call. No hold times. |
| **Visibility of effort** | Show Sarah what the system did (which vendors were queried, why some didn't work, what escalation path was chosen). |
| **Human-in-the-loop** | System recommends, Sarah decides. Don't auto-reorder without confirmation. |
| **Turnover-friendly** | A new nurse seeing this for the first time understands the flow without training. One tap to re-order, one tap to notify family. `[cut 8/14 — family comms out of demo scope]` |

---

## Integration Requirements

1. **Vendor callback webhook** — Must receive "Unable to Fulfill" status changes within minutes, not batch nightly
2. **Multi-vendor inventory query** — Real-time (or near-real-time) lookup of stock and ETA across all configured vendors
3. **EMR integration optional but valuable** — If connected, pull patient discharge date/time automatically (no manual entry)
4. **SMS/Email gateway** — For vendor notifications, family notifications, and alerts
5. **Performance tracking** — Log which vendors fail, how often, which ones fulfill orders on time (feeds vendor scoring)

---

## Success Metrics

- **Mean time to alert:** < 3 minutes from vendor failure to Sarah's phone
- **Mean time to re-order:** < 2 minutes from alert to Sarah tapping confirm
- **Re-order success rate:** % of failed orders that result in a successful alternative order within the deadline
- **Family satisfaction:** Measured through CAHPS question *"Equipment arrived when expected"* — should improve as failures are caught and recovered early

---

## Source annotations

- Scenario and user flow drawn from `wiki/facts/order-lifecycle.md` (DME-10305 at-risk example), `wiki/facts/personas.md` (case manager role), and `wiki/facts/user-scenarios.md` (fallback scenario).
- Differentiation principle: "visibility and speed" from `wiki/facts/problem.md` — sponsor's framing on how to win.
- Async communication baseline from `wiki/facts/personas.md` — vendor dispatcher design assumes they never log in, only respond to SMS/email.
