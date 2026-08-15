// N11 — replacement request flow (engine.md addendum #4).
//
// Nurse taps "Request replacement" on a condition_reported issue:
//   1. `reordered` on the original order, payload.reason = 'defect'
//   2. a new SAME-VENDOR order at price_cents = 0 — the vendor eats the trip,
//      which is the whole incentive. It sorts first on their run list.
//   3. a backup vendor is offered ONLY once the same-vendor redelivery is
//      declined or goes past its window.
//
// Nothing here auto-reorders. §2.3 is structural, not a comment:
//   - every write takes a `HumanConfirmation` carrying a named actor, so no rule
//     or sweep can call it without a person attached;
//   - `computeBackupOffer()` is read-only and returns a locked gate until the
//     redelivery actually fails;
//   - `acceptBackupOffer()` re-derives that gate from the log and throws when it
//     is locked, so an unlocked path cannot be faked by the caller.
//
// The comms lane owns `sendMessage()`. This module appends `vendor_notified`
// (the state) and leaves the outbound send to the caller.

import "server-only";

import { now } from "@/src/lib/clock";
import { reliabilityScore, type DerivableEvent } from "@/src/lib/derive";
import { appendEvent, type Actor } from "@/src/lib/events";
import { runRules } from "@/src/lib/rules";
import type { OrderUrgency } from "@/src/lib/domain";
import type { Database, Json } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
type OrderRow = Tables["orders"]["Row"];
type EventRow = Tables["order_events"]["Row"];

/* ------------------------------------------------------------------ *
 * Constants — all [assumed], none sponsor-supplied.
 * ------------------------------------------------------------------ */

/** Window the redelivery gets before "late" unlocks the backup offer. [assumed] */
export const REPLACEMENT_TARGET_HOURS = 4;

/** A defective time-critical item is a clinical event, so the redelivery is STAT. [assumed] */
export const REPLACEMENT_STAT_HCPCS: readonly string[] = [
  "E1390",
  "E0431",
  "E0601",
  "E0470",
  "E0600",
];

export type ReplacementReason = "defect";

/* ------------------------------------------------------------------ *
 * Pure helpers — the run-list lane imports these, no I/O.
 * ------------------------------------------------------------------ */

export type OrderItemShape = {
  hcpcs: string;
  plain_name?: string;
  qty?: number;
  /** Set on a replacement order's items — the order id being replaced. */
  replacement_of?: string;
};

function records(items: Json): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) =>
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? [raw as Record<string, unknown>]
      : [],
  );
}

export function orderItemShapes(items: Json): OrderItemShape[] {
  return records(items).flatMap((rec) => {
    const hcpcs = typeof rec.hcpcs === "string" ? rec.hcpcs : null;
    if (!hcpcs) return [];
    return [
      {
        hcpcs,
        plain_name: typeof rec.plain_name === "string" ? rec.plain_name : undefined,
        qty: typeof rec.qty === "number" ? rec.qty : undefined,
        replacement_of:
          typeof rec.replacement_of === "string" ? rec.replacement_of : undefined,
      },
    ];
  });
}

/** True when this order exists only because an earlier delivery arrived defective. */
export function isReplacementOrder(items: Json): boolean {
  return orderItemShapes(items).some((item) => Boolean(item.replacement_of));
}

/** The order id this replacement is redelivering against, or null. */
export function replacedOrderId(items: Json): string | null {
  return orderItemShapes(items).find((item) => item.replacement_of)?.replacement_of ?? null;
}

/**
 * Addendum #4: the same-vendor redelivery shows up FIRST on the run list.
 * Stable — non-replacements keep whatever order the caller sorted them into.
 */
export function sortReplacementsFirst<T>(rows: T[], items: (row: T) => Json): T[] {
  return rows
    .map((row, index) => ({ row, index, first: isReplacementOrder(items(row)) }))
    .sort((a, b) => Number(b.first) - Number(a.first) || a.index - b.index)
    .map((entry) => entry.row);
}

export type BackupGate =
  | { unlocked: true; because: "declined" | "late"; reason: string }
  | { unlocked: false; reason: string };

/**
 * The one place that decides whether a backup vendor may be offered.
 * Derived from the replacement order's own log — never from a caller flag.
 */
export function backupGate(
  events: DerivableEvent[],
  opts: { now: Date; targetAt: string | null },
): BackupGate {
  const chain = [...events].sort(
    (a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""),
  );

  if (chain.some((e) => e.type === "delivered")) {
    return { unlocked: false, reason: "The replacement was delivered." };
  }

  let declinedAt = -1;
  let confirmedAt = -1;
  for (const event of chain) {
    const at = Date.parse(event.created_at ?? "");
    if (event.type === "vendor_declined") declinedAt = at;
    if (event.type === "vendor_confirmed") confirmedAt = at;
  }
  if (declinedAt > confirmedAt && declinedAt > 0) {
    return {
      unlocked: true,
      because: "declined",
      reason: "The vendor declined the replacement stop.",
    };
  }

  const deadline = opts.targetAt ? Date.parse(opts.targetAt) : NaN;
  if (Number.isFinite(deadline) && opts.now.getTime() > deadline) {
    return {
      unlocked: true,
      because: "late",
      reason: "The replacement window has passed with no delivery.",
    };
  }

  return {
    unlocked: false,
    reason: "The vendor still has time on the replacement. Nothing is cancelled.",
  };
}

/* ------------------------------------------------------------------ *
 * Writes — every one requires a named human.
 * ------------------------------------------------------------------ */

/**
 * The structural no-auto-reorder guard. A rules sweep has no actor to put here,
 * so it cannot construct this value without inventing a person — which would be
 * visible in the event log as a fabricated actor rather than hidden in a boolean.
 */
export type HumanConfirmation = {
  confirmedBy: Actor;
  /** Free text the nurse typed, surfaced to the vendor. */
  note?: string;
};

export type ReplacementResult = {
  originalOrderId: string;
  replacementOrderId: string;
  replacementOrderNo: string;
  vendorId: string | null;
  targetAt: string;
  noCharge: boolean;
};

function requireEnv(): void {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }
}

async function db() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

async function loadOrder(orderId: string): Promise<OrderRow> {
  const client = await db();
  const result = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Order not found");
  return result.data;
}

async function loadEvents(orderId: string): Promise<EventRow[]> {
  const client = await db();
  const result = await client
    .from("order_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (result.error) throw result.error;
  return result.data ?? [];
}

/** `DME-10087` → `DME-10087-R1`, then `-R2`. Unique per specs/schema.sql. */
async function nextReplacementNo(baseOrderNo: string): Promise<string> {
  const client = await db();
  const result = await client
    .from("orders")
    .select("order_no")
    .like("order_no", `${baseOrderNo}-R%`);
  if (result.error) throw result.error;
  return `${baseOrderNo}-R${(result.data?.length ?? 0) + 1}`;
}

function replacementUrgency(codes: string[], original: OrderUrgency): OrderUrgency {
  return codes.some((code) => REPLACEMENT_STAT_HCPCS.includes(code)) ? "stat" : original;
}

async function createFollowOnOrder(input: {
  original: OrderRow;
  vendorId: string | null;
  priceCents: number | null;
  codes: string[];
  orderedAt: string;
  targetAt: string;
  actor: Actor;
  placedPayload: Record<string, Json>;
}): Promise<{ id: string; orderNo: string }> {
  const client = await db();
  const items: Json = orderItemShapes(input.original.items)
    .filter((item) => input.codes.includes(item.hcpcs))
    .map((item) => ({
      hcpcs: item.hcpcs,
      ...(item.plain_name ? { plain_name: item.plain_name } : {}),
      ...(item.qty ? { qty: item.qty } : {}),
      replacement_of: input.original.id,
    }));

  const orderNo = await nextReplacementNo(input.original.order_no);
  const urgency = replacementUrgency(input.codes, input.original.urgency);
  const inserted = await client
    .from("orders")
    .insert({
      order_no: orderNo,
      patient_id: input.original.patient_id,
      vendor_id: input.vendorId,
      hospice_account: input.original.hospice_account,
      status: "ordered",
      urgency,
      items,
      price_cents: input.priceCents,
      ordered_at: input.orderedAt,
      target_at: input.targetAt,
      ordered_by: input.actor.userName,
      ordered_by_role: input.actor.role,
    })
    .select("id,order_no")
    .single();
  if (inserted.error) throw inserted.error;

  await appendEvent(
    inserted.data.id,
    "order_placed",
    { items, urgency, target_at: input.targetAt, ...input.placedPayload },
    input.actor,
  );
  if (input.vendorId) {
    await appendEvent(
      inserted.data.id,
      "vendor_notified",
      { vendor_id: input.vendorId, channel: "sms", nudge: false, kind: "replacement" },
      input.actor,
    );
  }
  await runRules(inserted.data.id);
  return { id: inserted.data.id, orderNo: inserted.data.order_no };
}

/**
 * Step 1 of addendum #4. Same vendor, no charge, redelivery window from now.
 * `confirmation` is required — there is no unattended path into this function.
 */
export async function requestReplacement(input: {
  orderId: string;
  /** Defaults to every item on the order. */
  itemHcpcs?: string[];
  /** The `order_events.id` of the condition_reported row this answers. */
  conditionEventId?: number;
  confirmation: HumanConfirmation;
}): Promise<ReplacementResult> {
  requireEnv();
  const actor = input.confirmation.confirmedBy;
  const original = await loadOrder(input.orderId);
  const allCodes = orderItemShapes(original.items).map((item) => item.hcpcs);
  const codes = input.itemHcpcs?.length
    ? allCodes.filter((code) => input.itemHcpcs?.includes(code))
    : allCodes;
  if (codes.length === 0) throw new Error("No matching items on this order");

  const at = await now();
  const targetAt = new Date(
    at.getTime() + REPLACEMENT_TARGET_HOURS * 3_600_000,
  ).toISOString();

  const replacement = await createFollowOnOrder({
    original,
    vendorId: original.vendor_id,
    // The vendor eats the trip. That is the incentive, so it is a real zero,
    // not a display flag.
    priceCents: 0,
    codes,
    orderedAt: at.toISOString(),
    targetAt,
    actor,
    placedPayload: {
      replacement_of: original.id,
      reason: "defect",
      no_charge: true,
      ...(input.confirmation.note ? { note: input.confirmation.note } : {}),
    },
  });

  await appendEvent(
    original.id,
    "reordered",
    {
      // conditionScore() reads exactly this key for the defect-swap rate.
      reason: "defect" satisfies ReplacementReason,
      replaced_by: replacement.id,
      vendor_id: original.vendor_id,
      same_vendor: true,
      no_charge: true,
      items: codes,
      confirmed_by: actor.userName,
      confirmed_by_role: actor.role,
      confirmed_at: at.toISOString(),
      ...(input.conditionEventId ? { condition_event_id: input.conditionEventId } : {}),
      ...(input.confirmation.note ? { note: input.confirmation.note } : {}),
    },
    actor,
  );
  await runRules(original.id);

  return {
    originalOrderId: original.id,
    replacementOrderId: replacement.id,
    replacementOrderNo: replacement.orderNo,
    vendorId: original.vendor_id,
    targetAt,
    noCharge: true,
  };
}

/* ------------------------------------------------------------------ *
 * Backup offer — read-only until a human accepts.
 * ------------------------------------------------------------------ */

export type BackupCandidate = {
  vendorId: string;
  vendorName: string;
  priceCents: number;
  leadTimeHours: number;
  etaIso: string;
  meetsDeadline: boolean;
  /** `'unrated'` under the minimum order count — never rendered as 0. */
  reliability: number | "unrated";
};

export type BackupOffer = {
  replacementOrderId: string;
  gate: BackupGate;
  /** Empty whenever the gate is locked. Ranked best-first when it is open. */
  candidates: BackupCandidate[];
};

/**
 * Reads only. Returns a locked gate — and no candidates — while the same-vendor
 * redelivery is still live, so a UI cannot render an offer that isn't earned.
 */
export async function computeBackupOffer(
  replacementOrderId: string,
): Promise<BackupOffer> {
  requireEnv();
  const order = await loadOrder(replacementOrderId);
  const events = await loadEvents(replacementOrderId);
  const at = await now();
  const gate = backupGate(events, { now: at, targetAt: order.target_at });
  if (!gate.unlocked) return { replacementOrderId, gate, candidates: [] };

  const client = await db();
  const codes = orderItemShapes(order.items).map((item) => item.hcpcs);
  const prices = await client
    .from("vendor_prices")
    .select("vendor_id,hcpcs,price_cents,lead_time_hours,in_stock")
    .in("hcpcs", codes)
    .eq("in_stock", true);
  if (prices.error) throw prices.error;

  const byVendor = new Map<string, { total: number; lead: number; codes: Set<string> }>();
  for (const row of prices.data ?? []) {
    if (row.vendor_id === order.vendor_id) continue;
    const entry = byVendor.get(row.vendor_id) ?? { total: 0, lead: 0, codes: new Set() };
    if (entry.codes.has(row.hcpcs)) continue;
    entry.codes.add(row.hcpcs);
    entry.total += row.price_cents;
    entry.lead = Math.max(entry.lead, row.lead_time_hours);
    byVendor.set(row.vendor_id, entry);
  }
  const complete = [...byVendor.entries()].filter(
    ([, entry]) => entry.codes.size === new Set(codes).size,
  );
  if (complete.length === 0) return { replacementOrderId, gate, candidates: [] };

  const vendors = await client
    .from("vendors")
    .select("id,name")
    .eq("status", "active")
    .in(
      "id",
      complete.map(([vendorId]) => vendorId),
    );
  if (vendors.error) throw vendors.error;
  const names = new Map((vendors.data ?? []).map((v) => [v.id, v.name]));

  const vendorOrders = await client
    .from("orders")
    .select("id,vendor_id")
    .in("vendor_id", [...names.keys()]);
  if (vendorOrders.error) throw vendorOrders.error;
  const orderVendor = new Map((vendorOrders.data ?? []).map((o) => [o.id, o.vendor_id]));

  const history = new Map<string, DerivableEvent[]>();
  if (orderVendor.size > 0) {
    const rows = await client
      .from("order_events")
      .select("order_id,type,payload,created_at")
      .in("order_id", [...orderVendor.keys()]);
    if (rows.error) throw rows.error;
    for (const row of rows.data ?? []) {
      const vendorId = orderVendor.get(row.order_id);
      if (!vendorId) continue;
      const bucket = history.get(vendorId) ?? [];
      bucket.push(row);
      history.set(vendorId, bucket);
    }
  }

  const deadline = order.target_at ? Date.parse(order.target_at) : NaN;
  const candidates: BackupCandidate[] = complete.flatMap(([vendorId, entry]) => {
    const name = names.get(vendorId);
    if (!name) return [];
    const eta = new Date(at.getTime() + entry.lead * 3_600_000);
    const score = reliabilityScore(history.get(vendorId) ?? [], { now: at });
    return [
      {
        vendorId,
        vendorName: name,
        priceCents: entry.total,
        leadTimeHours: entry.lead,
        etaIso: eta.toISOString(),
        meetsDeadline: Number.isFinite(deadline) ? eta.getTime() <= deadline : true,
        reliability: score.score ?? ("unrated" as const),
      },
    ];
  });

  // Feasible first, then the better-rated supplier, then the cheaper one.
  candidates.sort(
    (a, b) =>
      Number(b.meetsDeadline) - Number(a.meetsDeadline) ||
      (typeof b.reliability === "number" ? b.reliability : -1) -
        (typeof a.reliability === "number" ? a.reliability : -1) ||
      a.priceCents - b.priceCents,
  );

  return { replacementOrderId, gate, candidates };
}

/**
 * Step 2 of addendum #4 — the one-tap human confirm. Re-derives the gate from
 * the log; a locked gate throws, so there is no code path where a decline or a
 * clock tick moves the order on its own. Nothing is cancelled: the same-vendor
 * replacement keeps its history and its `reordered` link.
 */
export async function acceptBackupOffer(input: {
  replacementOrderId: string;
  vendorId: string;
  confirmation: HumanConfirmation;
}): Promise<ReplacementResult> {
  requireEnv();
  const offer = await computeBackupOffer(input.replacementOrderId);
  if (!offer.gate.unlocked) {
    throw new Error(`Backup vendor is not available yet. ${offer.gate.reason}`);
  }
  const candidate = offer.candidates.find((c) => c.vendorId === input.vendorId);
  if (!candidate) throw new Error("That vendor cannot cover this order");

  const actor = input.confirmation.confirmedBy;
  const declined = await loadOrder(input.replacementOrderId);
  const codes = orderItemShapes(declined.items).map((item) => item.hcpcs);
  const at = await now();
  const targetAt =
    declined.target_at ??
    new Date(at.getTime() + REPLACEMENT_TARGET_HOURS * 3_600_000).toISOString();

  const backup = await createFollowOnOrder({
    original: declined,
    vendorId: candidate.vendorId,
    // A backup supplier is owed its price; only the original vendor eats the trip.
    priceCents: candidate.priceCents,
    codes,
    orderedAt: at.toISOString(),
    targetAt,
    actor,
    placedPayload: {
      replacement_of: declined.id,
      reason: offer.gate.because,
      backup_vendor: true,
      no_charge: false,
    },
  });

  await appendEvent(
    declined.id,
    "reordered",
    {
      // Not 'defect' — the backup hand-off must not be counted a second time
      // against the original vendor's condition score.
      reason: offer.gate.because,
      replaced_by: backup.id,
      vendor_id: candidate.vendorId,
      same_vendor: false,
      gate_reason: offer.gate.reason,
      confirmed_by: actor.userName,
      confirmed_by_role: actor.role,
      confirmed_at: at.toISOString(),
      ...(input.confirmation.note ? { note: input.confirmation.note } : {}),
    },
    actor,
  );
  await runRules(declined.id);

  return {
    originalOrderId: declined.id,
    replacementOrderId: backup.id,
    replacementOrderNo: backup.orderNo,
    vendorId: candidate.vendorId,
    targetAt,
    noCharge: false,
  };
}
