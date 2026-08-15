// T5 — billing clock + equipment-days-saved. Pure functions over order rows + events,
// no I/O, no ambient clock. Formula: specs/engine.md §4 (THE spec).
//   notificationLagHours = pickup_requested.at - patient_status_changed.at
//   baselineLagHours     = BASELINE_NOTIFY_LAG_H (settings-defaults.ts, 26h [assumed])
//   daysSaved             = max(0, (baselineLagHours - notificationLagHours) / 24)
//   dollarsSaved          = daysSaved * perDayCents(order price)
// Clock stop is pickup_requested — the timestamped notification, not the pickup
// (specs/00-contracts.md). File ownership: derive.ts owns badges/scores; this file
// owns the billing clock only.

import type { DerivableEvent } from "@/src/lib/derive";
import { perDayCents } from "@/src/lib/domain";
import { SETTING_DEFAULTS } from "@/src/lib/settings-defaults";

export type BillingOrder = {
  id: string;
  /** vendor_prices.price_cents — MONTHLY rental. null when no price on file. */
  price_cents: number | null;
  events: DerivableEvent[];
};

export type EquipmentSavedOptions = {
  /** Hours a business-day batch list would have taken to notify the vendor. */
  baselineNotifyLagH?: number;
};

export type OrderSaved = {
  orderId: string;
  notificationLagH: number;
  daysSaved: number;
  dollarsSavedCents: number;
};

export type EquipmentSavedResult = {
  daysSaved: number;
  dollarsSavedCents: number;
  n_orders: number;
  orders: OrderSaved[];
};

function ms(iso: string): number {
  return Date.parse(iso);
}

function chronological(a: DerivableEvent, b: DerivableEvent): number {
  return ms(a.created_at ?? "") - ms(b.created_at ?? "");
}

function first(events: DerivableEvent[], type: string): DerivableEvent | undefined {
  return events.find((e) => e.type === type);
}

/**
 * One order's days-saved, or null if it does not qualify: needs a
 * patient_status_changed event followed by a pickup_requested event (§4).
 * Negative lag (pickup notified before the clock would suggest, or a
 * pickup_requested that precedes patient_status_changed on a malformed chain)
 * floors at 0 saved, never negative.
 */
export function orderDaysSaved(
  events: DerivableEvent[],
  baselineNotifyLagH: number = SETTING_DEFAULTS.baseline_notify_lag_h,
): { notificationLagH: number; daysSaved: number } | null {
  const chain = events.every((e) => e.created_at) ? [...events].sort(chronological) : events;
  const statusChanged = first(chain, "patient_status_changed");
  const pickupRequested = chain.find(
    (e) =>
      e.type === "pickup_requested" &&
      statusChanged?.created_at !== undefined &&
      e.created_at !== undefined &&
      ms(e.created_at) >= ms(statusChanged.created_at),
  );
  if (!statusChanged?.created_at || !pickupRequested?.created_at) return null;

  const notificationLagH = (ms(pickupRequested.created_at) - ms(statusChanged.created_at)) / 3_600_000;
  const daysSaved = Math.max(0, (baselineNotifyLagH - notificationLagH) / 24);
  return { notificationLagH, daysSaved };
}

/** Aggregate equipment-days-saved and dollars-not-billed across orders (report view 12, "Saved" tab). */
export function equipmentDaysSaved(
  orders: BillingOrder[],
  opts: EquipmentSavedOptions = {},
): EquipmentSavedResult {
  const baselineNotifyLagH = opts.baselineNotifyLagH ?? SETTING_DEFAULTS.baseline_notify_lag_h;

  const perOrder: OrderSaved[] = [];
  for (const order of orders) {
    const saved = orderDaysSaved(order.events, baselineNotifyLagH);
    if (!saved || order.price_cents == null) continue;
    perOrder.push({
      orderId: order.id,
      notificationLagH: saved.notificationLagH,
      daysSaved: saved.daysSaved,
      dollarsSavedCents: Math.round(saved.daysSaved * perDayCents(order.price_cents)),
    });
  }

  return {
    daysSaved: perOrder.reduce((sum, o) => sum + o.daysSaved, 0),
    dollarsSavedCents: perOrder.reduce((sum, o) => sum + o.dollarsSavedCents, 0),
    n_orders: perOrder.length,
    orders: perOrder,
  };
}
