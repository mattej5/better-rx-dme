/**
 * What a nurse is allowed to record by hand after a phone call.
 *
 * Engine §1.1 already lets a nurse record a scheduled pickup she was told about
 * on the phone; this is the same idea for every other step the vendor may
 * report by voice. The list is deliberately short: only the step that can come
 * next from where the order actually is. `deriveStatus` recomputes the status
 * from the appended event, so nothing here writes `orders.status` directly.
 */

import type { EventType, OrderStatus } from "./domain";

export type ManualStep = { label: string; event: EventType };

const VENDOR_CONFIRMED: ManualStep = { label: "VENDOR CONFIRMED", event: "vendor_confirmed" };
const DISPATCHED: ManualStep = { label: "DISPATCHED", event: "dispatched" };
const DELIVERED: ManualStep = { label: "DELIVERED", event: "delivered" };
const PICKUP_SCHEDULED: ManualStep = { label: "PICKUP SCHEDULED", event: "pickup_scheduled" };
const PICKED_UP: ManualStep = { label: "PICKED UP", event: "picked_up" };

/**
 * `confirmed` is the vendor_confirmed event, not the status: an order stays
 * `ordered` from placement until dispatch, so the status alone cannot say
 * whether the vendor has already accepted it.
 */
export function legalNextSteps(
  status: OrderStatus,
  options: { confirmed: boolean },
): ManualStep[] {
  if (status === "ordered") {
    return options.confirmed ? [DISPATCHED, DELIVERED] : [VENDOR_CONFIRMED];
  }
  if (status === "dispatched" || status === "in_transit") return [DELIVERED];
  if (status === "pickup_triggered") return [PICKUP_SCHEDULED, PICKED_UP];
  return [];
}

export function isLegalNextStep(
  status: OrderStatus,
  options: { confirmed: boolean },
  event: EventType,
): boolean {
  return legalNextSteps(status, options).some((step) => step.event === event);
}
