import assert from "node:assert/strict";
import test from "node:test";

import {
  atRiskReason,
  awaitingApproval,
  conditionScore,
  deriveBadges,
  reliabilityScore,
  type DerivableEvent,
} from "./derive";

const H = 3_600_000;
const T0 = Date.parse("2026-08-10T08:00:00Z");
const iso = (hoursFromT0: number) => new Date(T0 + hoursFromT0 * H).toISOString();

type Spec = {
  id?: string;
  notifyGapMin?: number;
  /** Minutes delivered relative to the promised ETA. Negative = early. */
  deliveryErrorMin?: number;
  atRisk?: boolean;
  declineAfterMin?: number;
  /** Hours from T0 for order_placed.payload.target_at. Defaults to the promised ETA (base+24). */
  targetOffsetH?: number;
  pickupHours?: number | null;
  pickupBatched?: boolean;
  condition?: { functional: boolean; clean: boolean; repair: string };
  postIssue?: string;
  defectSwap?: boolean;
  disputeUpheldOnDelivery?: boolean;
};

/** Builds one realistic order chain. Promised ETA is always T0+24h for that order. */
function chain(spec: Spec, dayOffset = 0): DerivableEvent[] {
  const base = dayOffset * 72;
  const e: DerivableEvent[] = [
    {
      order_id: spec.id,
      type: "order_placed",
      created_at: iso(base),
      payload: { target_at: iso(base + (spec.targetOffsetH ?? 24)) },
    },
    { order_id: spec.id, type: "vendor_notified", created_at: iso(base), payload: { nudge: false } },
  ];
  const promised = iso(base + 24);
  if (spec.declineAfterMin !== undefined) {
    e.push({
      order_id: spec.id,
      type: "vendor_declined",
      created_at: iso(base + spec.declineAfterMin / 60),
      payload: { reason: "no stock", minutes_since_notified: spec.declineAfterMin },
    });
    return e;
  }
  e.push({
    order_id: spec.id,
    type: "vendor_confirmed",
    created_at: iso(base + (spec.notifyGapMin ?? 10) / 60),
    payload: { promised_eta: promised },
  });
  if (spec.atRisk) {
    e.push({
      order_id: spec.id,
      type: "at_risk_flagged",
      created_at: iso(base + 20),
      payload: { reason: "Vendor silent past the nudge ladder", rule: "silence" },
    });
  }
  if (spec.deliveryErrorMin !== undefined) {
    e.push({
      order_id: spec.id,
      type: "delivered",
      created_at: iso(base + 24 + spec.deliveryErrorMin / 60),
      payload: spec.disputeUpheldOnDelivery
        ? { signature: "R.N.", dispute_upheld: true }
        : { signature: "R.N." },
    });
  }
  if (spec.condition) {
    e.push({
      order_id: spec.id,
      type: "condition_reported",
      created_at: iso(base + 25),
      payload: { phase: "delivery", issue: "none", ...spec.condition },
    });
  }
  if (spec.postIssue) {
    e.push({
      order_id: spec.id,
      type: "condition_reported",
      created_at: iso(base + 30),
      payload: { phase: "post_delivery", issue: spec.postIssue },
    });
  }
  if (spec.defectSwap) {
    e.push({
      order_id: spec.id,
      type: "reordered",
      created_at: iso(base + 31),
      payload: { reason: "defect" },
    });
  }
  if (spec.pickupHours !== undefined) {
    e.push({
      order_id: spec.id,
      type: "pickup_requested",
      created_at: iso(base + 40),
      payload: { notified_vendor_ids: ["v1"] },
    });
    if (spec.pickupBatched) {
      e.push({
        order_id: spec.id,
        type: "pickup_scheduled",
        created_at: iso(base + 41),
        payload: { batched: true },
      });
    }
    if (spec.pickupHours !== null) {
      e.push({
        order_id: spec.id,
        type: "picked_up",
        created_at: iso(base + 40 + spec.pickupHours),
        payload: { condition_photo_url: null },
      });
    }
  }
  return e;
}

function vendor(specs: Spec[]): DerivableEvent[] {
  return specs.flatMap((s, i) => chain(s, i));
}

const GOOD: Spec = {
  notifyGapMin: 8,
  deliveryErrorMin: -20,
  pickupHours: 6,
  condition: { functional: true, clean: true, repair: "good" },
};

test("unrated: fewer than 5 orders scores null, never zero", () => {
  const events = vendor([GOOD, GOOD, GOOD, GOOD].map((s, i) => ({ ...s, id: `u${i}` })));
  const r = reliabilityScore(events);
  assert.equal(r.score, null);
  assert.equal(r.label, "Unrated");
  assert.equal(r.n_orders, 4);
  assert.equal(r.breakdown.length, 6, "breakdown still renders so the vendor sees what fills in");
  const c = conditionScore(events);
  assert.equal(c.score, null);
  assert.equal(c.label, "Unrated");
  assert.equal(c.breakdown.length, 5);
});

test("high reliability: on-time, fast confirms, quick pickups", () => {
  const events = vendor(
    Array.from({ length: 6 }, (_, i) => ({ ...GOOD, id: `h${i}` })),
  );
  const r = reliabilityScore(events);
  assert.equal(r.n_orders, 6);
  assert.ok(r.score !== null && r.score >= 90, `expected >=90, got ${r.score}`);
  assert.equal(r.label, String(r.score));
  assert.equal(r.breakdown.find((b) => b.key === "on_time")?.value, 100);
  assert.equal(r.breakdown.find((b) => b.key === "at_risk_freq")?.value, 100);
  assert.equal(r.breakdown.find((b) => b.variable === "on_time")?.n, 6, "variable aliases key");
});

test("declined-heavy: late declines sink the score harder than early ones", () => {
  const late = vendor(
    Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, declineAfterMin: 300 })),
  );
  const early = vendor(
    Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, declineAfterMin: 20 })),
  );
  const lateVal = reliabilityScore(late).breakdown.find((b) => b.key === "decline_behavior")?.value;
  const earlyVal = reliabilityScore(early).breakdown.find((b) => b.key === "decline_behavior")?.value;
  assert.equal(lateVal, 0);
  assert.equal(earlyVal, 75, "early decline weighs 0.25 -> 100 - 25");
  assert.ok((earlyVal as number) > (lateVal as number));
});

test("late deliveries and at-risk history drag reliability down", () => {
  const bad = vendor(
    Array.from({ length: 6 }, (_, i) => ({
      id: `b${i}`,
      notifyGapMin: 200,
      deliveryErrorMin: 200,
      atRisk: true,
      pickupHours: 60,
    })),
  );
  const r = reliabilityScore(bad);
  assert.ok(r.score !== null && r.score < 30, `expected <30, got ${r.score}`);
  assert.equal(r.breakdown.find((b) => b.key === "on_time")?.value, 0);
  assert.equal(r.breakdown.find((b) => b.key === "at_risk_freq")?.value, 0);
});

test("batched pickup inside the green window does not ding (fairness path)", () => {
  const plain = vendor(
    Array.from({ length: 5 }, (_, i) => ({ ...GOOD, id: `p${i}`, pickupHours: 20 })),
  );
  const batched = vendor(
    Array.from({ length: 5 }, (_, i) => ({
      ...GOOD,
      id: `q${i}`,
      pickupHours: 20,
      pickupBatched: true,
    })),
  );
  const a = reliabilityScore(plain).breakdown.find((b) => b.key === "pickup_timeliness")?.value;
  const b = reliabilityScore(batched).breakdown.find((b) => b.key === "pickup_timeliness")?.value;
  assert.equal(a, 100, "inside the 24h green window, even a non-batched pickup scores full credit");
  assert.equal(b, 100);
});

test("batching does not forgive a pickup past the green window (36h)", () => {
  const plain = vendor(
    Array.from({ length: 5 }, (_, i) => ({ ...GOOD, id: `p${i}`, pickupHours: 36 })),
  );
  const batched = vendor(
    Array.from({ length: 5 }, (_, i) => ({
      ...GOOD,
      id: `q${i}`,
      pickupHours: 36,
      pickupBatched: true,
    })),
  );
  const a = reliabilityScore(plain).breakdown.find((b) => b.key === "pickup_timeliness")?.value;
  const b = reliabilityScore(batched).breakdown.find((b) => b.key === "pickup_timeliness")?.value;
  // 36h is past the 24h green line; batching only forgives inside the green window now,
  // so both plain and batched fall on the same clamp(100 - (h-24)*100/(72-24)) curve.
  assert.equal(a, 75);
  assert.equal(b, 75, "batching no longer buys credit all the way out to the 72h red line");
});

test("open pickup is only aged when a clock is supplied", () => {
  const specs = Array.from({ length: 5 }, (_, i) => ({ ...GOOD, id: `o${i}`, pickupHours: null }));
  const events = vendor(specs);
  const noClock = reliabilityScore(events).breakdown.find((b) => b.key === "pickup_timeliness");
  assert.equal(noClock?.value, null);
  assert.equal(noClock?.n, 0);
  // Last order's pickup_requested is at T0 + 4*72 + 40 h; 30h later is past the 24h green line.
  const stale = new Date(T0 + (4 * 72 + 70) * H);
  const withClock = reliabilityScore(events, { now: stale }).breakdown.find(
    (b) => b.key === "pickup_timeliness",
  );
  assert.ok((withClock?.value as number) < 100);
});

test("upheld dispute drops the event out of scoring", () => {
  const specs = Array.from({ length: 5 }, (_, i) => ({
    ...GOOD,
    id: `d${i}`,
    deliveryErrorMin: 400,
  }));
  const dinged = reliabilityScore(vendor(specs));
  const forgiven = reliabilityScore(
    vendor(specs.map((s) => ({ ...s, disputeUpheldOnDelivery: true }))),
  );
  assert.equal(dinged.breakdown.find((b) => b.key === "on_time")?.value, 0);
  assert.equal(
    forgiven.breakdown.find((b) => b.key === "on_time")?.value,
    null,
    "disputed deliveries leave nothing to measure",
  );
});

test("on-time scores the target window, not the promised ETA (Gulf Coast fairness)", () => {
  // Hospice's real deadline (target_at) is 30h out; the vendor's own promised ETA is
  // the tighter, chronically-optimistic 24h. Delivery lands at 27h: late vs the vendor's
  // own promise (dings eta_accuracy) but comfortably inside the hospice's real window
  // (on_time should stay high) — the exact "fast STAT/oxygen, optimistic ETAs" profile.
  const optimistic = vendor(
    Array.from({ length: 6 }, (_, i) => ({
      id: `g${i}`,
      targetOffsetH: 30,
      deliveryErrorMin: 180, // delivered 3h after the 24h promised ETA -> at base+27h
    })),
  );
  const r = reliabilityScore(optimistic);
  const onTime = r.breakdown.find((b) => b.key === "on_time");
  const etaAcc = r.breakdown.find((b) => b.key === "eta_accuracy");
  assert.equal(onTime?.value, 100, "27h delivery beats the 30h target window");
  assert.equal(etaAcc?.value, 0, "180min error hits etaZeroErrMin, caught even though on time");

  // Same delivery timing, but target_at equals the promised ETA (no real target window
  // set) — on_time and eta_accuracy agree and both read the vendor as late.
  const sameAsPromised = vendor(
    Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      targetOffsetH: 24,
      deliveryErrorMin: 180,
    })),
  );
  const noWindow = reliabilityScore(sameAsPromised).breakdown.find((b) => b.key === "on_time");
  assert.equal(noWindow?.value, 0, "with no real target window, on_time tracks the missed promised ETA");
});

test("on_time falls back to promisedEta when order_placed carries no target_at", () => {
  const orderId = "no-target";
  const promised = iso(24);
  const events: DerivableEvent[] = [
    { order_id: orderId, type: "order_placed", created_at: iso(0), payload: {} },
    { order_id: orderId, type: "vendor_notified", created_at: iso(0), payload: {} },
    {
      order_id: orderId,
      type: "vendor_confirmed",
      created_at: iso(0.2),
      payload: { promised_eta: promised },
    },
    { order_id: orderId, type: "delivered", created_at: iso(30), payload: {} },
  ];
  const onTime = reliabilityScore(
    // pad to MIN_ORDERS_FOR_SCORE with GOOD chains so the score is not "Unrated"
    [...events, ...vendor(Array.from({ length: 4 }, (_, i) => ({ ...GOOD, id: `pad${i}` })))],
  ).breakdown.find((b) => b.key === "on_time");
  assert.equal(onTime?.n, 5);
  assert.ok((onTime?.value as number) < 100, "delivered 6h after the promised ETA fallback, not on time");
});

test("condition: damaged path scores far below the clean path", () => {
  const clean = vendor(
    Array.from({ length: 5 }, (_, i) => ({ ...GOOD, id: `c${i}` })),
  );
  const damaged = vendor(
    Array.from({ length: 5 }, (_, i) => ({
      ...GOOD,
      id: `x${i}`,
      condition: { functional: false, clean: false, repair: "poor" },
      postIssue: "damaged",
      defectSwap: true,
    })),
  );
  const good = conditionScore(clean);
  const bad = conditionScore(damaged);
  assert.equal(good.score, 100);
  assert.equal(bad.score, 0);
  assert.equal(bad.breakdown.find((b) => b.key === "defect_swap")?.value, 0);
  assert.equal(bad.breakdown.find((b) => b.key === "post_delivery_issues")?.value, 0);
  assert.equal(good.n_orders, 5);
});

test("condition n counts delivered orders only", () => {
  const events = vendor(
    Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, declineAfterMin: 10 })),
  );
  const c = conditionScore(events);
  assert.equal(c.n_orders, 0);
  assert.equal(c.label, "Unrated");
});

test("badges: at-risk flagged, then cleared", () => {
  const flagged = chain({ id: "a1", atRisk: true, notifyGapMin: 5 });
  assert.deepEqual(deriveBadges(flagged), ["AT_RISK"]);
  assert.equal(atRiskReason(flagged), "Vendor silent past the nudge ladder");

  const cleared = [
    ...flagged,
    { order_id: "a1", type: "at_risk_cleared", created_at: iso(21), payload: { reason: "ETA held" } },
  ];
  assert.deepEqual(deriveBadges(cleared), []);
  assert.equal(atRiskReason(cleared), "Vendor silent past the nudge ladder");

  const reflagged = [
    ...cleared,
    { order_id: "a1", type: "at_risk_flagged", created_at: iso(22), payload: { reason: "Driver broke down" } },
  ];
  assert.deepEqual(deriveBadges(reflagged), ["AT_RISK"]);
  assert.equal(atRiskReason(reflagged), "Driver broke down", "newest reason wins");
  assert.equal(atRiskReason(chain({ id: "a2", notifyGapMin: 5 })), null);
});

test("badges: pickup delayed at amber, still delayed at red, AT_RISK sorts first", () => {
  const open = chain({ id: "p1", atRisk: true, notifyGapMin: 5, pickupHours: null });
  const requestedAt = T0 + 40 * H;

  assert.deepEqual(deriveBadges(open), ["AT_RISK"], "no clock, no pickup age");
  assert.deepEqual(deriveBadges(open, { now: new Date(requestedAt + 12 * H) }), ["AT_RISK"]);
  assert.deepEqual(deriveBadges(open, { now: new Date(requestedAt + 25 * H) }), [
    "AT_RISK",
    "PICKUP_DELAYED",
  ]);
  assert.deepEqual(deriveBadges(open, { now: new Date(requestedAt + 50 * H) }), [
    "AT_RISK",
    "PICKUP_DELAYED",
  ]);
  assert.deepEqual(
    deriveBadges(open, { now: new Date(requestedAt + 25 * H), pickupAmberH: 48 }),
    ["AT_RISK"],
    "threshold is a parameter",
  );

  const done = chain({ id: "p2", notifyGapMin: 5, pickupHours: 90 });
  assert.deepEqual(deriveBadges(done, { now: new Date(requestedAt + 200 * H) }), []);
  assert.deepEqual(deriveBadges([]), []);
});

test("awaitingApproval on and off", () => {
  const requested: DerivableEvent[] = [
    { order_id: "z", type: "order_placed", created_at: iso(0) },
    { order_id: "z", type: "approval_requested", created_at: iso(1), payload: { price_cents: 90_000 } },
  ];
  assert.equal(awaitingApproval(requested), true);
  assert.equal(
    awaitingApproval([...requested, { order_id: "z", type: "approved", created_at: iso(2) }]),
    false,
  );
  assert.equal(
    awaitingApproval([...requested, { order_id: "z", type: "denied", created_at: iso(2) }]),
    false,
  );
  assert.equal(awaitingApproval([{ order_id: "z", type: "order_placed" }]), false);
});
