import assert from "node:assert/strict";
import test from "node:test";

import { groupAtRisk } from "./at-risk-groups";

const LATE = "The vendor has not confirmed and the needed-by time is close.";
const PICKUP = "Pickup was requested and the equipment is still in the home.";

test("same reason collapses to one group", () => {
  const groups = groupAtRisk([
    { orderId: "a", reason: LATE },
    { orderId: "b", reason: LATE },
    { orderId: "c", reason: LATE },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 3);
  assert.equal(groups[0].reason, LATE);
});

test("distinct reasons stay separate, in input order", () => {
  const groups = groupAtRisk([
    { orderId: "a", reason: LATE },
    { orderId: "b", reason: PICKUP },
  ]);
  assert.deepEqual(
    groups.map((g) => g.reason),
    [LATE, PICKUP],
  );
  assert.deepEqual(
    groups.map((g) => g.count),
    [1, 1],
  );
});

test("a single order shows the bare reason, no count", () => {
  const [group] = groupAtRisk([{ orderId: "a", reason: LATE }]);
  assert.equal(group.label, LATE);
});

test("two or more orders show the count", () => {
  const [group] = groupAtRisk([
    { orderId: "a", reason: LATE },
    { orderId: "b", reason: LATE },
  ]);
  assert.equal(group.label, `2 orders: ${LATE}`);
});

test("the group links to the first order given", () => {
  const [group] = groupAtRisk([
    { orderId: "worst", reason: LATE },
    { orderId: "other", reason: LATE },
  ]);
  assert.equal(group.orderId, "worst");
});

test("no at-risk orders means no banners", () => {
  assert.deepEqual(groupAtRisk([]), []);
});

test("one rule collapses reasons that differ only in their numbers", () => {
  const groups = groupAtRisk([
    { orderId: "a", reason: "23.9 hours to the 9:37 AM discharge.", rule: "lead_time_gap" },
    { orderId: "b", reason: "23.6 hours to the 9:39 AM discharge.", rule: "lead_time_gap" },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "2 orders: 23.9 hours to the 9:37 AM discharge.");
});

test("different rules stay separate even under one patient", () => {
  const groups = groupAtRisk([
    { orderId: "a", reason: LATE, rule: "lead_time_gap" },
    { orderId: "b", reason: LATE, rule: "no_confirm_window" },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["lead_time_gap", "no_confirm_window"],
  );
});

test("a missing rule falls back to the reason string", () => {
  const groups = groupAtRisk([
    { orderId: "a", reason: LATE, rule: null },
    { orderId: "b", reason: LATE },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, LATE);
  assert.equal(groups[0].count, 2);
});
