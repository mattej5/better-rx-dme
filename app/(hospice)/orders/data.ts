import "server-only";
import type { Database } from "@/src/types/db";
import type { TimelineEvent } from "@/src/lib/domain";
import { EVENT_COPY, URGENCY_LABEL, formatDayTime, formatUsd } from "@/src/lib/domain";
import {
  hasSupabaseEnv,
  orderItems,
  type Loaded,
  type OrderEventRow,
  type OrderRow,
  type PatientRow,
} from "../patients/data";

type Tables = Database["public"]["Tables"];
export type MessageRow = Tables["messages"]["Row"];

export type { Loaded, OrderEventRow, OrderRow, PatientRow };

/** A vendor that carries every item on the order, with the total monthly rental. */
export type VendorOption = {
  vendorId: string;
  name: string;
  monthlyPriceCents: number;
  leadTimeHours: number;
};

export type OrderDetail = {
  order: OrderRow;
  patient: PatientRow | null;
  vendorName: string | null;
  events: OrderEventRow[];
  messages: MessageRow[];
  /** Cheapest contracted vendor other than the one on the order. Null when there is none. */
  backup: VendorOption | null;
  /** order_no of the order this one replaced, and of the one that replaced it. */
  replacesOrder: { id: string; orderNo: string } | null;
  replacedByOrder: { id: string; orderNo: string } | null;
};

async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

type Db = Awaited<ReturnType<typeof client>>;

function payloadOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** True when the order is in the pickup half of its life. Pickups are never rerouted. */
export function isPickupOrder(order: OrderRow, events: { type: string }[]): boolean {
  return (
    order.status === "pickup_triggered" ||
    order.status === "picked_up" ||
    events.some((e) => e.type === "pickup_requested")
  );
}

export function itemQuantities(order: OrderRow): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of orderItems(order.items)) {
    map.set(item.hcpcs, (map.get(item.hcpcs) ?? 0) + (item.qty ?? 1));
  }
  return map;
}

/**
 * Cheapest vendor, other than the current one, that stocks every HCPCS on the order.
 * Same ranking input the compare step uses at order time: vendor_prices joined vendors.
 */
export async function pickBackupVendor(
  db: Db,
  order: OrderRow,
): Promise<VendorOption | null> {
  const quantities = itemQuantities(order);
  const codes = [...quantities.keys()];
  if (codes.length === 0) return null;

  const prices = await db
    .from("vendor_prices")
    .select("vendor_id,hcpcs,price_cents,in_stock,lead_time_hours")
    .in("hcpcs", codes);
  if (prices.error) return null;

  const totals = new Map<string, { total: number; lead: number; covered: Set<string> }>();
  for (const price of prices.data ?? []) {
    if (price.vendor_id === order.vendor_id || !price.in_stock) continue;
    const entry = totals.get(price.vendor_id) ?? { total: 0, lead: 0, covered: new Set<string>() };
    if (entry.covered.has(price.hcpcs)) continue;
    entry.covered.add(price.hcpcs);
    entry.total += price.price_cents * (quantities.get(price.hcpcs) ?? 1);
    entry.lead = Math.max(entry.lead, price.lead_time_hours);
    totals.set(price.vendor_id, entry);
  }

  const complete = [...totals].filter(([, entry]) => entry.covered.size === codes.length);
  if (complete.length === 0) return null;

  const vendors = await db
    .from("vendors")
    .select("id,name,status")
    .in("id", complete.map(([vendorId]) => vendorId));
  if (vendors.error) return null;

  const byId = new Map((vendors.data ?? []).filter((v) => v.status === "active").map((v) => [v.id, v.name]));
  const ranked = complete
    .flatMap(([vendorId, entry]) => {
      const name = byId.get(vendorId);
      return name
        ? [{ vendorId, name, monthlyPriceCents: entry.total, leadTimeHours: entry.lead }]
        : [];
    })
    .sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);

  return ranked[0] ?? null;
}

/** Loads one order. `data: null` means no such order — a calm page, not an error. */
export async function loadOrderDetail(orderId: string): Promise<Loaded<OrderDetail | null>> {
  if (!hasSupabaseEnv()) return { ok: false };
  try {
    const db = await client();
    // Invalid uuid text (Postgres 22P02) lands in `error` too; a mistyped link is
    // treated as not found rather than as a failure.
    const order = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (order.error || !order.data) return { ok: true, data: null };
    const row = order.data;

    const [events, messages, patient, vendor] = await Promise.all([
      db
        .from("order_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      db.from("messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      db.from("patients").select("*").eq("id", row.patient_id).maybeSingle(),
      row.vendor_id
        ? db.from("vendors").select("name").eq("id", row.vendor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (events.error || messages.error) return { ok: false };

    const eventRows = events.data ?? [];
    const linkedIds = new Set<string>();
    for (const event of eventRows) {
      const p = payloadOf(event.payload);
      const replaces = text(p.replaces);
      const replacedBy = text(p.replaced_by);
      if (event.type === "order_placed" && replaces) linkedIds.add(replaces);
      if (event.type === "reordered" && replacedBy) linkedIds.add(replacedBy);
    }
    const linked = new Map<string, string>();
    if (linkedIds.size > 0) {
      const res = await db.from("orders").select("id,order_no").in("id", [...linkedIds]);
      for (const o of res.data ?? []) linked.set(o.id, o.order_no);
    }

    function linkFor(type: string, key: string) {
      for (const event of eventRows) {
        if (event.type !== type) continue;
        const id = text(payloadOf(event.payload)[key]);
        const orderNo = id ? linked.get(id) : undefined;
        if (id && orderNo) return { id, orderNo };
      }
      return null;
    }

    return {
      ok: true,
      data: {
        order: row,
        patient: patient.data ?? null,
        vendorName: vendor.data?.name ?? null,
        events: eventRows,
        messages: messages.data ?? [],
        backup: await pickBackupVendor(db, row),
        replacesOrder: linkFor("order_placed", "replaces"),
        replacedByOrder: linkFor("reordered", "replaced_by"),
      },
    };
  } catch {
    return { ok: false };
  }
}

const STATUS_CHANGE_COPY: Record<string, string> = {
  deceased: "Patient is deceased",
  discharged: "Patient discharged",
  condition_worsened: "Condition worsened",
};

function itemSummary(items: unknown): string | null {
  const list = orderItems(items as OrderRow["items"]);
  if (list.length === 0) return null;
  return list
    .map((item) => `${item.qty && item.qty > 1 ? `${item.qty} × ` : ""}${item.plain_name ?? item.hcpcs}`)
    .join(", ");
}

function detailFor(event: OrderEventRow, replacedNo: string | null): string | null {
  const p = payloadOf(event.payload);
  const reason = text(p.reason);
  switch (event.type) {
    case "order_placed": {
      const summary = itemSummary(p.items);
      const urgency = text(p.urgency);
      const label = urgency && urgency in URGENCY_LABEL
        ? URGENCY_LABEL[urgency as keyof typeof URGENCY_LABEL]
        : null;
      return [summary, label].filter(Boolean).join(" · ") || null;
    }
    case "at_risk_flagged":
    case "at_risk_cleared":
    case "escalated":
    case "denied":
    case "vendor_declined":
      return reason;
    case "reordered":
      return [reason ? `Reason: ${reason}` : null, replacedNo ? `Replaced by order ${replacedNo}` : null]
        .filter(Boolean)
        .join(" · ") || null;
    case "eta_updated": {
      const eta = text(p.eta_iso) ?? text(p.eta);
      return eta ? `ETA ${formatDayTime(eta)}` : null;
    }
    case "vendor_confirmed": {
      const eta = text(p.promised_eta);
      return eta ? `Promised ${formatDayTime(eta)}` : null;
    }
    case "approval_requested":
    case "approved": {
      const price = typeof p.price_cents === "number" ? p.price_cents : null;
      return price === null ? reason : `${formatUsd(price)}/month${reason ? ` · ${reason}` : ""}`;
    }
    case "condition_reported": {
      const issue = text(p.issue);
      if (!issue) return null;
      return issue === "none" ? "No problems reported" : `Reported: ${issue}`;
    }
    case "patient_status_changed": {
      const status = text(p.status);
      return status ? (STATUS_CHANGE_COPY[status] ?? status) : null;
    }
    case "pickup_scheduled": {
      const start = text(p.window_start);
      return start ? `Window starts ${formatDayTime(start)}` : null;
    }
    case "delivered": {
      const signed = text(p.signature_name);
      return signed ? `Signed by ${signed}` : null;
    }
    default:
      return reason;
  }
}

function parsedLine(parsed: unknown): { line: string; confidence: number } | null {
  const p = payloadOf(parsed);
  const confidence = typeof p.confidence === "number" ? p.confidence : null;
  if (confidence === null) return null;
  const parts: string[] = [];
  const intent = text(p.intent);
  if (intent) parts.push(intent.replace(/_/g, " "));
  const eta = text(p.eta_iso) ?? text(p.eta);
  if (eta) parts.push(`ETA ${formatDayTime(eta)}`);
  const delay = typeof p.delay_minutes === "number" ? p.delay_minutes : null;
  if (delay !== null) parts.push(`delayed about ${Math.round(delay)} minutes`);
  const reason = text(p.reason);
  if (reason) parts.push(`reason: ${reason}`);
  if (parts.length === 0) return null;
  return { line: parts.join(", "), confidence };
}

const MESSAGE_MATCH_MS = 5 * 60 * 1000;

/**
 * One timeline row per event, oldest first. Unknown event types fall through with
 * their raw string — EventTimeline already guarantees that, and this keeps it true.
 */
export function toTimeline(
  events: OrderEventRow[],
  messages: MessageRow[],
  vendorName: string | null,
  replacedNo: string | null,
): TimelineEvent[] {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const used = new Set<string>();

  return events.map((event) => {
    const p = payloadOf(event.payload);
    const inbound = event.type === "message_received";
    let message: MessageRow | undefined;

    if (event.type === "message_sent" || inbound) {
      const id = text(p.message_id);
      message = id ? byId.get(id) : undefined;
      if (!message) {
        const wanted = inbound ? "inbound" : "outbound";
        message = messages
          .filter((m) => m.direction === wanted && !used.has(m.id))
          .sort(
            (a, b) =>
              Math.abs(Date.parse(a.created_at) - Date.parse(event.created_at)) -
              Math.abs(Date.parse(b.created_at) - Date.parse(event.created_at)),
          )
          .find(
            (m) =>
              Math.abs(Date.parse(m.created_at) - Date.parse(event.created_at)) <= MESSAGE_MATCH_MS,
          );
      }
      if (message) used.add(message.id);
    }

    const body = message?.body ?? text(p.body);
    const parsed = message ? parsedLine(message.parsed) : null;

    return {
      id: event.id,
      type: event.type,
      at: event.created_at,
      actor: event.actor,
      detail: detailFor(event, replacedNo),
      ...(body
        ? {
            message: {
              direction: (inbound ? "inbound" : "outbound") as "inbound" | "outbound",
              body,
              who: inbound ? (vendorName ?? "Vendor") : "BetterRX DME",
            },
          }
        : {}),
      ...(parsed ? { parsed } : {}),
    } satisfies TimelineEvent;
  });
}

export function eventCopy(type: string): string {
  return EVENT_COPY[type as keyof typeof EVENT_COPY] ?? type;
}

/** "3 hours to fix" / "40 minutes to fix", or null when there is no needed-by time. */
export function timeLeftLabel(targetAt: string | null, now: Date): string | null {
  if (!targetAt) return null;
  const minutes = (Date.parse(targetAt) - now.getTime()) / 60_000;
  if (Number.isNaN(minutes)) return null;
  if (minutes <= 0) return "The needed-by time has passed";
  if (minutes < 90) return `${Math.round(minutes)} minutes to fix`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} to fix`;
}
