import "server-only";

import { now } from "@/src/lib/clock";
import { appendEvent, type OrderEvent } from "@/src/lib/events";
import { formatTime } from "@/src/lib/domain";
import { loadSettings } from "@/app/(hospice)/settings/data";
import type { OrderUrgency } from "@/src/lib/domain";
import type { Database, Json } from "@/src/types/db";

export type RuleId =
  | "eta_misses_deadline"
  | "eta_tight"
  | "confirmation_silence"
  | "lead_time_buffer"
  | "pickup_delayed";

export type RiskFlag = {
  rule: RuleId;
  severity: "amber" | "red";
  reason: string;
  firedAt: string;
};

export type RulesRunResult = {
  flagged: number;
  cleared: number;
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type CatalogRow = Pick<
  Database["public"]["Tables"]["equipment_catalog"]["Row"],
  "hcpcs" | "plain_name" | "time_critical"
>;
type PriceRow = Pick<
  Database["public"]["Tables"]["vendor_prices"]["Row"],
  "hcpcs" | "price_cents" | "vendor_id"
>;

type Item = {
  hcpcs?: unknown;
  plain_name?: unknown;
  unit_price_cents?: unknown;
};

type Decision = {
  flag?: Omit<RiskFlag, "firedAt">;
  clearReason: string;
};

type RuleState = {
  decision: Decision;
  latestEvent?: OrderEvent;
};

const RULE_IDS: readonly RuleId[] = [
  "eta_misses_deadline",
  "eta_tight",
  "confirmation_silence",
  "lead_time_buffer",
  "pickup_delayed",
];

const SYSTEM_ACTOR = {
  role: "case_manager" as const,
  userName: "BetterRX at-risk rules",
};

function eventPayload(event: OrderEvent | undefined): Record<string, Json | undefined> {
  if (!event?.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return {};
  }
  return event.payload as Record<string, Json | undefined>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(event: OrderEvent | undefined): Date | null {
  return dateValue(event?.created_at);
}

function latestEvent(events: OrderEvent[], type: string): OrderEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === type) return events[index];
  }
  return undefined;
}

function eventAfter(events: OrderEvent[], type: string, after: Date): OrderEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const at = eventDate(event);
    if (event.type === type && at && at >= after) return event;
  }
  return undefined;
}

function orderItems(order: OrderRow): Item[] {
  if (!Array.isArray(order.items)) return [];
  return order.items.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    return [item as Item];
  });
}

function hcpcs(items: Item[]): string[] {
  return [...new Set(items.flatMap((item) => {
    const code = stringValue(item.hcpcs);
    return code ? [code] : [];
  }))];
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function minutesLabel(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}

function hoursLabel(hours: number): string {
  const rounded = Math.max(1 / 60, Math.round(hours * 10) / 10);
  return `${formatNumber(rounded)} hour${rounded === 1 ? "" : "s"}`;
}

function itemName(item: Item | undefined, catalog: Map<string, CatalogRow>): string {
  const code = stringValue(item?.hcpcs);
  const catalogName = code ? catalog.get(code)?.plain_name : undefined;
  return catalogName ?? stringValue(item?.plain_name) ?? code ?? "Equipment";
}

function targetAt(order: OrderRow, events: OrderEvent[]): Date | null {
  return dateValue(order.target_at) ?? dateValue(eventPayload(latestEvent(events, "order_placed")).target_at);
}

function latestEta(events: OrderEvent[]): { at: Date; iso: string } | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type !== "eta_updated") continue;
    const payload = eventPayload(events[index]);
    const iso = stringValue(payload.eta_iso) ?? stringValue(payload.eta);
    const at = dateValue(iso);
    if (iso && at) return { at, iso };
  }
  return null;
}

function latestRiskEvent(events: OrderEvent[], rule: RuleId): OrderEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "at_risk_flagged" && event.type !== "at_risk_cleared") continue;
    if (stringValue(eventPayload(event).rule) === rule) return event;
  }
  return undefined;
}

function riskReason(event: OrderEvent | undefined): string | null {
  return stringValue(eventPayload(event).reason);
}

function riskDecisions(
  order: OrderRow,
  events: OrderEvent[],
  catalog: Map<string, CatalogRow>,
  prices: PriceRow[],
  vendorName: string,
  settings: Awaited<ReturnType<typeof loadSettings>>["values"],
  current: Date,
): Map<RuleId, Decision> {
  const decisions = new Map<RuleId, Decision>();
  const items = orderItems(order);
  const codes = hcpcs(items);
  const highRiskItems = items.filter((item) => {
    const code = stringValue(item.hcpcs);
    const catalogItem = code ? catalog.get(code) : undefined;
    const unitPrice = typeof item.unit_price_cents === "number" ? item.unit_price_cents : 0;
    const vendorPrice = prices.some((price) => price.hcpcs === code && price.price_cents >= 40_000);
    return unitPrice >= 40_000 || vendorPrice || catalogItem?.time_critical === true;
  });
  const isHighRisk = highRiskItems.length > 0;
  const highRiskLabel = itemName(highRiskItems[0], catalog);
  const normalLabel = itemName(items[0], catalog);
  const label = isHighRisk ? highRiskLabel : normalLabel;
  const urgency = order.urgency as OrderUrgency;
  const deadline = targetAt(order, events);
  const eta = latestEta(events);
  const delivered = latestEvent(events, "delivered");

  const missesDeadline = !delivered && deadline && eta && eta.at.getTime() > deadline.getTime();
  const lateMinutes = missesDeadline && deadline && eta
    ? Math.max(1, Math.round((eta.at.getTime() - deadline.getTime()) / 60_000))
    : 0;
  decisions.set("eta_misses_deadline", {
    flag: missesDeadline && deadline && eta
      ? {
        rule: "eta_misses_deadline",
        severity: "red",
        reason: `Delivery ETA ${formatTime(eta.iso)}, discharge ${formatTime(deadline.toISOString())} — misses by ${lateMinutes} minutes.`,
      }
      : undefined,
    clearReason: delivered
      ? "The order was delivered, so the delivery deadline risk is resolved."
      : eta && deadline && eta.at.getTime() <= deadline.getTime()
        ? `Latest ETA ${formatTime(eta.iso)} is before the ${formatTime(deadline.toISOString())} discharge deadline.`
        : "The order no longer has an ETA past its discharge deadline.",
  });

  const etaMarginMinutes = deadline && eta
    ? (deadline.getTime() - eta.at.getTime()) / 60_000
    : null;
  const etaTight = !delivered && etaMarginMinutes !== null && etaMarginMinutes >= 0
    && etaMarginMinutes <= settings.eta_amber_margin_min;
  const tightMinutes = etaMarginMinutes === null ? 0 : Math.max(0, Math.round(etaMarginMinutes));
  decisions.set("eta_tight", {
    flag: etaTight && eta && deadline
      ? {
        rule: "eta_tight",
        severity: "amber",
        reason: `ETA ${formatTime(eta.iso)} leaves ${tightMinutes} minutes before the ${formatTime(deadline.toISOString())} discharge — no room for traffic.`,
      }
      : undefined,
    clearReason: delivered
      ? "The order was delivered, so the tight ETA risk is resolved."
      : eta && deadline && etaMarginMinutes !== null && etaMarginMinutes > settings.eta_amber_margin_min
        ? `Latest ETA ${formatTime(eta.iso)} leaves ${Math.round(etaMarginMinutes)} minutes before the ${formatTime(deadline.toISOString())} discharge deadline.`
        : "The latest ETA no longer falls inside the configured amber margin.",
  });

  const notified = latestEvent(events, "vendor_notified");
  const notifiedAt = eventDate(notified);
  const confirmed = notifiedAt ? eventAfter(events, "vendor_confirmed", notifiedAt) : undefined;
  const silenceMinutes = settings.silence_minutes[urgency];
  const silenceElapsedMinutes = notifiedAt
    ? (current.getTime() - notifiedAt.getTime()) / 60_000
    : 0;
  const silenceFired = !delivered && Boolean(notifiedAt) && !confirmed && silenceElapsedMinutes > silenceMinutes;
  const silenceSeverity = silenceElapsedMinutes > silenceMinutes * 2 ? "red" : "amber";
  decisions.set("confirmation_silence", {
    flag: silenceFired && notifiedAt
      ? {
        rule: "confirmation_silence",
        severity: silenceSeverity,
        reason: `Sent to ${vendorName} at ${formatTime(notifiedAt.toISOString())}. No confirmation in ${minutesLabel(silenceElapsedMinutes)} (${urgency} orders: ${minutesLabel(silenceMinutes)} window).`,
      }
      : undefined,
    clearReason: confirmed
      ? `Vendor confirmed at ${formatTime(eventDate(confirmed)?.toISOString() ?? current.toISOString())}; the ${minutesLabel(silenceMinutes)} silence window is closed.`
      : delivered
        ? "The order was delivered, so confirmation silence is resolved."
        : "The vendor confirmation silence rule is no longer active.",
  });

  const leadHours = settings.lead_time_hours[urgency];
  const bufferHours = isHighRisk ? settings.high_risk_buffer_h : 0;
  const requiredHours = leadHours + bufferHours;
  const hoursToDeadline = deadline
    ? (deadline.getTime() - current.getTime()) / 3_600_000
    : null;
  const leadTimeFired = !delivered && !eta && hoursToDeadline !== null && hoursToDeadline < requiredHours;
  decisions.set("lead_time_buffer", {
    flag: leadTimeFired && deadline && hoursToDeadline !== null
      ? {
        rule: "lead_time_buffer",
        severity: "amber",
        reason: isHighRisk
          ? `${label}, no ETA yet. ${hoursToDeadline >= 0 ? `${formatNumber(hoursToDeadline)} hours to the ${formatTime(deadline.toISOString())} discharge` : `The ${formatTime(deadline.toISOString())} discharge deadline was ${formatNumber(Math.abs(hoursToDeadline))} hours ago`}; this vendor typically needs ${formatNumber(leadHours)} hours plus a ${formatNumber(bufferHours)}-hour safety buffer for high-risk equipment.`
          : `${label}, no ETA yet. ${hoursToDeadline >= 0 ? `${formatNumber(hoursToDeadline)} hours to the ${formatTime(deadline.toISOString())} discharge` : `The ${formatTime(deadline.toISOString())} discharge deadline was ${formatNumber(Math.abs(hoursToDeadline))} hours ago`}; this vendor typically needs ${formatNumber(leadHours)} hours for a ${urgency} order.`,
      }
      : undefined,
    clearReason: delivered
      ? "The order was delivered, so the lead-time buffer risk is resolved."
      : eta
        ? `Vendor provided an ETA of ${formatTime(eta.iso)}; the ${formatNumber(requiredHours)}-hour lead-time buffer no longer applies.`
        : "The order has enough time remaining for its configured lead-time buffer.",
  });

  const pickupRequested = latestEvent(events, "pickup_requested");
  const pickupAt = eventDate(pickupRequested);
  const pickedUpAfter = pickupAt ? eventAfter(events, "picked_up", pickupAt) : undefined;
  const pickupElapsedHours = pickupAt
    ? (current.getTime() - pickupAt.getTime()) / 3_600_000
    : 0;
  const pickupAmberHours = settings.pickup_amber_h;
  const pickupRedHours = settings.pickup_red_h;
  const pickupFired = Boolean(pickupAt) && !pickedUpAfter && pickupElapsedHours > pickupAmberHours;
  const pickupSeverity = pickupElapsedHours > pickupRedHours ? "red" : "amber";
  const pickupThreshold = pickupSeverity === "red" ? pickupRedHours : pickupAmberHours;
  decisions.set("pickup_delayed", {
    flag: pickupFired && pickupAt
      ? {
        rule: "pickup_delayed",
        severity: pickupSeverity,
        reason: `${label} pickup was requested ${hoursLabel(pickupElapsedHours)} ago. No pickup completed; the ${formatNumber(pickupThreshold)}-hour pickup window has passed.`,
      }
      : undefined,
    clearReason: pickedUpAfter
      ? `Pickup completed at ${formatTime(eventDate(pickedUpAfter)?.toISOString() ?? current.toISOString())}; the ${formatNumber(pickupAmberHours)}-hour pickup delay is resolved.`
      : "The pickup delay rule is no longer active.",
  });

  return decisions;
}

async function orderContext(orderId: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }

  const { supabase } = await import("@/src/lib/supabase");
  const [orderResult, eventResult] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabase.from("order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (orderResult.error) throw orderResult.error;
  if (eventResult.error) throw eventResult.error;
  if (!orderResult.data) throw new Error(`Order not found: ${orderId}`);

  const order = orderResult.data as OrderRow;
  const codes = hcpcs(orderItems(order));
  const [catalogResult, pricesResult, vendorResult] = await Promise.all([
    codes.length
      ? supabase.from("equipment_catalog").select("hcpcs, plain_name, time_critical").in("hcpcs", codes)
      : Promise.resolve({ data: [], error: null }),
    codes.length
      ? supabase.from("vendor_prices").select("hcpcs, price_cents, vendor_id").in("hcpcs", codes)
      : Promise.resolve({ data: [], error: null }),
    order.vendor_id
      ? supabase.from("vendors").select("name").eq("id", order.vendor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (catalogResult.error) throw catalogResult.error;
  if (pricesResult.error) throw pricesResult.error;
  if (vendorResult.error) throw vendorResult.error;

  return {
    order,
    events: (eventResult.data ?? []) as OrderEvent[],
    catalog: new Map(
      (catalogResult.data ?? []).map((row) => [row.hcpcs, row] as [string, CatalogRow]),
    ),
    prices: (pricesResult.data ?? []) as PriceRow[],
    vendorName: vendorResult.data?.name ?? "the vendor",
  };
}

export async function runRules(orderId: string): Promise<RulesRunResult> {
  const [context, settings, current] = await Promise.all([
    orderContext(orderId),
    loadSettings(),
    now(),
  ]);
  const decisions = riskDecisions(
    context.order,
    context.events,
    context.catalog,
    context.prices,
    context.vendorName,
    settings.values,
    current,
  );
  let flagged = 0;
  let cleared = 0;

  for (const rule of RULE_IDS) {
    const decision = decisions.get(rule);
    if (!decision) continue;
    const previous = latestRiskEvent(context.events, rule);
    const previousReason = riskReason(previous);
    if (decision.flag) {
      if (previous?.type === "at_risk_flagged" && previousReason === decision.flag.reason) continue;
      await appendEvent(orderId, "at_risk_flagged", {
        reason: decision.flag.reason,
        rule: decision.flag.rule,
      }, SYSTEM_ACTOR);
      flagged += 1;
    } else if (previous?.type === "at_risk_flagged") {
      await appendEvent(orderId, "at_risk_cleared", {
        reason: decision.clearReason,
        rule,
      }, SYSTEM_ACTOR);
      cleared += 1;
    }
  }

  return { flagged, cleared };
}

export async function runRulesSweep(): Promise<RulesRunResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }
  const { supabase } = await import("@/src/lib/supabase");
  const result = await supabase.from("orders").select("id").neq("status", "picked_up");
  if (result.error) throw result.error;

  let flagged = 0;
  let cleared = 0;
  for (const order of result.data ?? []) {
    const outcome = await runRules(order.id);
    flagged += outcome.flagged;
    cleared += outcome.cleared;
  }
  return { flagged, cleared };
}
