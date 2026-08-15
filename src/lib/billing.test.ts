import assert from "node:assert/strict";
import test from "node:test";

import { equipmentDaysSaved, orderDaysSaved, type BillingOrder } from "./billing";
import type { DerivableEvent } from "./derive";

const H = 3_600_000;
const T0 = Date.parse("2026-08-10T08:00:00Z");
const iso = (hoursFromT0: number) => new Date(T0 + hoursFromT0 * H).toISOString();

const BASELINE_H = 26;

function chain(orderId: string, statusChangedAtH: number, pickupRequestedAtH: number | null): DerivableEvent[] {
  const events: DerivableEvent[] = [
    { order_id: orderId, type: "order_placed", created_at: iso(0), payload: {} },
    {
      order_id: orderId,
      type: "patient_status_changed",
      created_at: iso(statusChangedAtH),
      payload: { status: "deceased" },
    },
  ];
  if (pickupRequestedAtH !== null) {
    events.push({
      order_id: orderId,
      type: "pickup_requested",
      created_at: iso(pickupRequestedAtH),
      payload: { notified_vendor_ids: ["v1"] },
    });
  }
  return events;
}

test("same-moment notification saves the full baseline (max saved)", () => {
  const events = chain("o1", 10, 10);
  const result = orderDaysSaved(events, BASELINE_H);
  assert.ok(result);
  assert.equal(result?.notificationLagH, 0);
  assert.equal(result?.daysSaved, BASELINE_H / 24);
});

test("26h lag matches the baseline exactly: zero saved", () => {
  const events = chain("o2", 10, 10 + BASELINE_H);
  const result = orderDaysSaved(events, BASELINE_H);
  assert.ok(result);
  assert.equal(result?.notificationLagH, BASELINE_H);
  assert.equal(result?.daysSaved, 0);
});

test("lag beyond baseline floors at zero, never negative", () => {
  const events = chain("o3", 10, 10 + BASELINE_H + 24);
  const result = orderDaysSaved(events, BASELINE_H);
  assert.ok(result);
  assert.equal(result?.daysSaved, 0);
});

test("partial lag (13h) saves half a day", () => {
  const events = chain("o4", 10, 10 + 13);
  const result = orderDaysSaved(events, BASELINE_H);
  assert.ok(result);
  assert.equal(result?.notificationLagH, 13);
  assert.equal(result?.daysSaved, (BASELINE_H - 13) / 24);
});

test("no pickup_requested yet: does not qualify", () => {
  const events = chain("o5", 10, null);
  assert.equal(orderDaysSaved(events, BASELINE_H), null);
});

test("no patient_status_changed: does not qualify", () => {
  const events: DerivableEvent[] = [
    { order_id: "o6", type: "order_placed", created_at: iso(0), payload: {} },
    { order_id: "o6", type: "pickup_requested", created_at: iso(10), payload: {} },
  ];
  assert.equal(orderDaysSaved(events, BASELINE_H), null);
});

test("equipmentDaysSaved aggregates across orders and converts to dollars", () => {
  const orders: BillingOrder[] = [
    { id: "o1", price_cents: 30_000, events: chain("o1", 10, 10) }, // 26/24 days, $1000/mo -> $1000/30=$33.33/day
    { id: "o4", price_cents: 30_000, events: chain("o4", 10, 10 + 13) },
    { id: "o5", price_cents: 30_000, events: chain("o5", 10, null) }, // excluded
  ];
  const result = equipmentDaysSaved(orders, { baselineNotifyLagH: BASELINE_H });
  assert.equal(result.n_orders, 2);
  const expectedDays = BASELINE_H / 24 + (BASELINE_H - 13) / 24;
  assert.ok(Math.abs(result.daysSaved - expectedDays) < 1e-9);
  assert.ok(result.dollarsSavedCents > 0);
});

test("equipmentDaysSaved excludes orders with no price on file", () => {
  const orders: BillingOrder[] = [{ id: "o1", price_cents: null, events: chain("o1", 10, 10) }];
  const result = equipmentDaysSaved(orders, { baselineNotifyLagH: BASELINE_H });
  assert.equal(result.n_orders, 0);
  assert.equal(result.daysSaved, 0);
  assert.equal(result.dollarsSavedCents, 0);
});

test("equipmentDaysSaved defaults baseline from settings-defaults when omitted", () => {
  const orders: BillingOrder[] = [{ id: "o1", price_cents: 30_000, events: chain("o1", 10, 10) }];
  const result = equipmentDaysSaved(orders);
  assert.equal(result.n_orders, 1);
  assert.ok(Math.abs(result.daysSaved - 26 / 24) < 1e-9, "default baseline is 26h");
});
