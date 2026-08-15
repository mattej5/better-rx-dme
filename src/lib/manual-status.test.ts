import assert from "node:assert/strict";
import test from "node:test";

import { isLegalNextStep, legalNextSteps } from "./manual-status";

const events = (steps: { event: string }[]) => steps.map((s) => s.event);

test("an unconfirmed order can only be marked confirmed", () => {
  assert.deepEqual(events(legalNextSteps("ordered", { confirmed: false })), [
    "vendor_confirmed",
  ]);
});

test("a confirmed order can be marked dispatched or delivered", () => {
  assert.deepEqual(events(legalNextSteps("ordered", { confirmed: true })), [
    "dispatched",
    "delivered",
  ]);
});

test("a dispatched order can only be marked delivered", () => {
  assert.deepEqual(events(legalNextSteps("dispatched", { confirmed: true })), ["delivered"]);
  assert.deepEqual(events(legalNextSteps("in_transit", { confirmed: true })), ["delivered"]);
});

test("a pickup offers both pickup steps", () => {
  assert.deepEqual(events(legalNextSteps("pickup_triggered", { confirmed: true })), [
    "pickup_scheduled",
    "picked_up",
  ]);
});

test("finished orders offer nothing", () => {
  assert.deepEqual(legalNextSteps("delivered", { confirmed: true }), []);
  assert.deepEqual(legalNextSteps("picked_up", { confirmed: true }), []);
});

test("labels are short and uppercase", () => {
  for (const status of ["ordered", "dispatched", "pickup_triggered"] as const) {
    for (const step of legalNextSteps(status, { confirmed: true })) {
      assert.equal(step.label, step.label.toUpperCase());
      assert.ok(step.label.length <= 20);
    }
  }
});

test("backwards and skipped steps are rejected", () => {
  assert.equal(isLegalNextStep("dispatched", { confirmed: true }, "vendor_confirmed"), false);
  assert.equal(isLegalNextStep("ordered", { confirmed: false }, "delivered"), false);
  assert.equal(isLegalNextStep("delivered", { confirmed: true }, "picked_up"), false);
  assert.equal(isLegalNextStep("pickup_triggered", { confirmed: true }, "picked_up"), true);
});
