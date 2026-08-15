import assert from "node:assert/strict";
import test from "node:test";

import { groupBundles, type BundleOrder } from "./order-bundles";

const AT = "2026-08-15T14:30:00.000Z";

function order(over: Partial<BundleOrder> & { orderId: string }): BundleOrder {
  return { patientId: "p1", vendorId: "v1", orderedAt: AT, ...over };
}

test("one action, five items, one card", () => {
  const groups = groupBundles([
    order({ orderId: "a" }),
    order({ orderId: "b" }),
    order({ orderId: "c" }),
    order({ orderId: "d" }),
    order({ orderId: "e" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 5);
  assert.equal(groups[0].itemsLabel, "5 items");
  assert.equal(groups[0].lead.orderId, "a");
});

test("same minute, different seconds, still one bundle", () => {
  const groups = groupBundles([
    order({ orderId: "a", orderedAt: "2026-08-15T14:30:02.000Z" }),
    order({ orderId: "b", orderedAt: "2026-08-15T14:30:41.000Z" }),
  ]);
  assert.equal(groups.length, 1);
});

test("different vendors never bundle", () => {
  const groups = groupBundles([
    order({ orderId: "a", vendorId: "v1" }),
    order({ orderId: "b", vendorId: "v2" }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.count), [1, 1]);
});

test("different patients never bundle", () => {
  const groups = groupBundles([
    order({ orderId: "a", patientId: "p1" }),
    order({ orderId: "b", patientId: "p2" }),
  ]);
  assert.equal(groups.length, 2);
});

test("more than a minute apart never bundles", () => {
  const groups = groupBundles([
    order({ orderId: "a", orderedAt: "2026-08-15T14:30:00.000Z" }),
    order({ orderId: "b", orderedAt: "2026-08-15T14:32:00.000Z" }),
  ]);
  assert.equal(groups.length, 2);
});

test("a lone order reads as one item", () => {
  const [group] = groupBundles([order({ orderId: "a" })]);
  assert.equal(group.itemsLabel, "1 item");
  assert.equal(group.count, 1);
});

test("two orders read as two items", () => {
  const [group] = groupBundles([order({ orderId: "a" }), order({ orderId: "b" })]);
  assert.equal(group.itemsLabel, "2 items");
});

test("vendorless orders bundle with each other, not with a vendor's", () => {
  const groups = groupBundles([
    order({ orderId: "a", vendorId: null }),
    order({ orderId: "b", vendorId: null }),
    order({ orderId: "c", vendorId: "v1" }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2);
});

test("no orders means no cards", () => {
  assert.deepEqual(groupBundles([]), []);
});

test("extra fields survive the grouping", () => {
  const groups = groupBundles([
    { ...order({ orderId: "a" }), status: "ordered" as const },
  ]);
  assert.equal(groups[0].lead.status, "ordered");
});
