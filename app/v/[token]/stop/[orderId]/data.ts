// N7 — the read behind /v/[token]/stop/[orderId].
//
// Two paths, and the page says which one it is on:
//   db      — real order, real event log, real writes
//   fixture — magic-link.ts's no-database preview. The card renders so the flow
//             is visible, and every button reports honestly that nothing saved.
import "server-only";

import { now } from "@/src/lib/clock";
import type { ConditionValue, OrderStatus, StopVariant } from "@/src/lib/domain";
import { formatDayTime, formatTime } from "@/src/lib/domain";
import { formatAddress, loadRunList, resolveToken } from "@/src/lib/magic-link";
import type { LinkSource, ResolvedLink } from "@/src/lib/magic-link";
import { isReplacementOrder } from "@/src/lib/replacement";
import type { Database, Json } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
type OrderRow = Tables["orders"]["Row"];
type EventRow = Tables["order_events"]["Row"];
type EquipmentRow = Tables["equipment_catalog"]["Row"];

export type StopStage =
  /** Delivery / swap, nothing promised yet. */
  | "needs_eta"
  /** An ETA exists. The next tap is the completion. */
  | "on_the_way"
  | "delivered"
  /** Pickup requested, no window agreed. */
  | "needs_window"
  /** Window agreed, waiting on the truck. */
  | "pickup_ready"
  | "picked_up"
  | "declined";

export type StopItemView = { hcpcs: string; plainName: string; qty: number };

export type CapturedProof = {
  kind: "delivered" | "picked_up";
  at: string;
  photoUrl: string | null;
  signatureName: string | null;
  signatureImageUrl: string | null;
  /** False when the capture happened but had nowhere to be stored. */
  stored: boolean;
  note: string | null;
};

export type StopDetail = {
  source: LinkSource;
  token: string;
  orderId: string;
  orderNo: string;
  vendorName: string;
  hospiceName: string;
  variant: StopVariant;
  hazmat: boolean;
  status: OrderStatus;
  stage: StopStage;
  patientLabel: string;
  address: string;
  addressNote: string | null;
  mapHref: string;
  windowLabel: string;
  items: StopItemView[];
  familyNote: string | null;
  /** N11: this stop exists because the first delivery arrived defective. */
  isReplacement: boolean;
  replacementNoCharge: boolean;
  etaIso: string | null;
  targetAtIso: string | null;
  declineReason: string | null;
  conditionReported: ConditionValue | null;
  proof: CapturedProof | null;
};

export type StopLoad =
  | { ok: true; data: StopDetail }
  | { ok: false; kind: "link_closed" | "expired" | "not_found" | "error" };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

export function mapHrefFor(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function lastOf(events: EventRow[], type: string): EventRow | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) return events[i];
  }
  return undefined;
}

/**
 * The one place the driver's next tap is decided. Read off the log, never off a
 * client flag, so a refresh mid-stop lands on the same button.
 */
export function stageOf(
  variant: StopVariant,
  events: EventRow[],
  status: OrderStatus,
): StopStage {
  const has = (type: string) => events.some((e) => e.type === type);

  if (variant === "pickup") {
    if (has("picked_up") || status === "picked_up") return "picked_up";
    return has("pickup_scheduled") ? "pickup_ready" : "needs_window";
  }

  if (has("delivered") || status === "delivered") return "delivered";

  const declined = lastOf(events, "vendor_declined");
  const confirmed = lastOf(events, "vendor_confirmed");
  if (declined && (!confirmed || declined.id > confirmed.id)) return "declined";

  return has("eta_updated") || has("vendor_confirmed") || status === "in_transit"
    ? "on_the_way"
    : "needs_eta";
}

function proofOf(events: EventRow[]): CapturedProof | null {
  const pickedUp = lastOf(events, "picked_up");
  const delivered = lastOf(events, "delivered");
  const event = pickedUp ?? delivered;
  if (!event) return null;
  const payload = record(event.payload);
  return {
    kind: event.type === "picked_up" ? "picked_up" : "delivered",
    at:
      text(payload.picked_up_at) ??
      text(payload.delivered_at) ??
      event.created_at,
    photoUrl: text(payload.condition_photo_url) ?? text(payload.pod_photo_url),
    signatureName: text(payload.signature_name) ?? text(payload.signature),
    signatureImageUrl: text(payload.signature_image_url),
    stored: payload.capture_stored !== false,
    note: text(payload.capture_note),
  };
}

function conditionOf(events: EventRow[]): ConditionValue | null {
  const event = lastOf(events, "condition_reported");
  if (!event) return null;
  const value = record(event.payload).condition;
  return value === "none" || value === "dirty" || value === "damaged" || value === "not_working"
    ? value
    : null;
}

function itemViews(items: Json, catalog: Map<string, EquipmentRow>): StopItemView[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const rec = record(raw);
    const hcpcs = text(rec.hcpcs);
    if (!hcpcs) return [];
    return [
      {
        hcpcs,
        plainName: text(rec.plain_name) ?? catalog.get(hcpcs)?.plain_name ?? hcpcs,
        qty: typeof rec.qty === "number" && rec.qty > 0 ? rec.qty : 1,
      },
    ];
  });
}

function windowLabelFor(
  variant: StopVariant,
  order: OrderRow,
  events: EventRow[],
): string {
  if (variant === "pickup") {
    const scheduled = lastOf(events, "pickup_scheduled");
    const payload = record(scheduled?.payload);
    const start = text(payload.window_start) ?? order.pickup_scheduled_at;
    if (start) {
      const end = text(payload.window_end);
      return end
        ? `${formatDayTime(start)} – ${formatTime(end)}`
        : formatDayTime(start);
    }
    return order.pickup_requested_at
      ? `Requested ${formatDayTime(order.pickup_requested_at)}`
      : "No time set yet";
  }
  const eta = order.current_eta ?? order.promised_eta;
  if (eta) return `ETA ${formatDayTime(eta)}`;
  if (order.target_at) return `Needed by ${formatDayTime(order.target_at)}`;
  return "No time set yet";
}

export async function loadStopDetail(
  token: string,
  orderId: string,
): Promise<StopLoad> {
  const clock = await now();
  const resolved = await resolveToken(token, clock);
  if (resolved.status === "expired") return { ok: false, kind: "expired" };
  if (resolved.status !== "ok") return { ok: false, kind: "link_closed" };
  const link = resolved.link;

  if (link.source === "fixture") return fixtureStop(link, orderId, clock);

  try {
    const db = await client();
    const order = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (order.error) return { ok: false, kind: "error" };
    if (!order.data) return { ok: false, kind: "not_found" };
    if (order.data.vendor_id !== link.vendor.id) return { ok: false, kind: "not_found" };

    const [patientRes, eventsRes, catalogRes, swapRes] = await Promise.all([
      db.from("patients").select("*").eq("id", order.data.patient_id).maybeSingle(),
      db
        .from("order_events")
        .select("*")
        .eq("order_id", order.data.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      db.from("equipment_catalog").select("*"),
      db
        .from("resupply_schedules")
        .select("hcpcs")
        .eq("patient_id", order.data.patient_id)
        .eq("is_swap", true)
        .eq("active", true),
    ]);
    if (patientRes.error || !patientRes.data) return { ok: false, kind: "error" };
    if (eventsRes.error || catalogRes.error || swapRes.error) {
      return { ok: false, kind: "error" };
    }

    const patient = patientRes.data;
    const events = eventsRes.data ?? [];
    const catalog = new Map((catalogRes.data ?? []).map((row) => [row.hcpcs, row]));
    const items = itemViews(order.data.items, catalog);
    const swapCodes = new Set((swapRes.data ?? []).map((row) => row.hcpcs));

    // Same rule magic-link.ts#stopVariant uses on the run list, so the badge on
    // the list and the card on the detail can never disagree.
    const variant: StopVariant =
      order.data.status === "pickup_triggered" || order.data.status === "picked_up"
        ? "pickup"
        : items.some((item) => swapCodes.has(item.hcpcs))
          ? "oxygen_swap"
          : "delivery";

    const address = formatAddress(patient.address);
    const declined = lastOf(events, "vendor_declined");
    const placed = events.find((e) => e.type === "order_placed");

    return {
      ok: true,
      data: {
        source: "db",
        token,
        orderId: order.data.id,
        orderNo: order.data.order_no,
        vendorName: link.vendor.name,
        hospiceName: patient.hospice_name,
        variant,
        hazmat: items.some((item) => catalog.get(item.hcpcs)?.hazmat === true),
        status: order.data.status,
        stage: stageOf(variant, events, order.data.status),
        patientLabel: `${patient.first_name} ${patient.last_name.slice(0, 1)}.`,
        address,
        addressNote: text(record(patient.address).note),
        mapHref: mapHrefFor(address),
        windowLabel: windowLabelFor(variant, order.data, events),
        items,
        familyNote: text(record(lastOf(events, "pickup_requested")?.payload).family_note),
        isReplacement: isReplacementOrder(order.data.items),
        replacementNoCharge: record(placed?.payload).no_charge === true,
        etaIso: order.data.current_eta ?? order.data.promised_eta,
        targetAtIso: order.data.target_at,
        declineReason: text(record(declined?.payload).reason),
        conditionReported: conditionOf(events),
        proof: proofOf(events),
      },
    };
  } catch {
    return { ok: false, kind: "error" };
  }
}

/**
 * STUB pending SUPABASE_SERVICE_ROLE_KEY — mirrors magic-link.ts's fixture run
 * list so "Open stop" works in a no-database preview. The stage is derived from
 * the fixture status only; there is no event log to read.
 */
async function fixtureStop(
  link: ResolvedLink,
  orderId: string,
  clock: Date,
): Promise<StopLoad> {
  const result = await loadRunList(link, clock);
  if (!result.ok) return { ok: false, kind: "error" };
  const stop = result.data.stops.find((s) => s.orderId === orderId);
  if (!stop) return { ok: false, kind: "not_found" };

  const stage: StopStage =
    stop.variant === "pickup"
      ? "needs_window"
      : stop.status === "dispatched" || stop.status === "in_transit"
        ? "on_the_way"
        : "needs_eta";

  return {
    ok: true,
    data: {
      source: "fixture",
      token: link.token,
      orderId: stop.orderId,
      orderNo: stop.orderNo,
      vendorName: link.vendor.name,
      hospiceName: stop.hospiceName,
      variant: stop.variant,
      hazmat: stop.hazmat,
      status: stop.status,
      stage,
      patientLabel: stop.patientLabel,
      address: stop.address,
      addressNote: stop.addressNote,
      mapHref: mapHrefFor(stop.address),
      windowLabel: stop.windowStart
        ? formatDayTime(stop.windowStart)
        : "No time set yet",
      items: stop.items.map((item) => ({
        hcpcs: item.hcpcs,
        plainName: item.plainName,
        qty: item.qty,
      })),
      familyNote: stop.familyNote,
      isReplacement: false,
      replacementNoCharge: false,
      etaIso: stop.windowKind === "eta" ? stop.windowStart : null,
      targetAtIso: stop.windowKind === "needed_by" ? stop.windowStart : null,
      declineReason: null,
      conditionReported: null,
      proof: null,
    },
  };
}
