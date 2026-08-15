import "server-only";

import { now } from "@/src/lib/clock";
import { appendEvent, type Actor } from "@/src/lib/events";
import type { Database, Json } from "@/src/types/db";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type PatientStatus = "active" | "condition_worsened" | "deceased" | "discharged";

export type PatientStatusReceipt = {
  patient: PatientRow;
  ordersAffected: number;
  ordersProcessed: number;
  pickupsRequested: number;
  vendorsNotified: number;
  at: string;
};

export type PatientStatusOptions = {
  actor?: Actor;
  externalId?: string;
  hospiceAccount?: string;
  /** External ids already recorded for this externalId's prefix — used to resume a retried fan-out. */
  doneExternalIds?: Set<string>;
};

const SYSTEM_ACTOR: Actor = { role: "case_manager", userName: "BetterRX eRx ingress" };

function itemHcpcs(items: Json): string[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const hcpcs = item.hcpcs;
    return typeof hcpcs === "string" ? [hcpcs] : [];
  });
}

async function appendStatusEvent(
  orderId: string,
  status: PatientStatus,
  changedAt: string,
  actor: Actor,
  externalId?: string,
): Promise<void> {
  const payload = { to: status, changed_at: changedAt };
  await appendEvent(orderId, "patient_status_changed", payload, actor, externalId ? { externalId } : undefined);
}

export async function changePatientStatus(
  patientId: string,
  status: PatientStatus,
  options: PatientStatusOptions = {},
): Promise<PatientStatusReceipt> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }

  const { supabase } = await import("@/src/lib/supabase");
  const actor = options.actor ?? SYSTEM_ACTOR;
  const at = (await now()).toISOString();
  const patientResult = await supabase
    .from("patients")
    .update({ care_status: status, status_changed_at: at })
    .eq("id", patientId)
    .select("*")
    .maybeSingle();
  if (patientResult.error) throw patientResult.error;
  if (!patientResult.data) throw new Error("Patient not found");

  // Every active order — pickup_triggered orders are still active until picked_up and
  // still get patient_status_changed (data.md §1.4: "per active order").
  let ordersQuery = supabase
    .from("orders")
    .select("*")
    .eq("patient_id", patientId)
    .neq("status", "picked_up")
    .order("ordered_at", { ascending: true })
    .order("id", { ascending: true });
  if (options.hospiceAccount) {
    ordersQuery = ordersQuery.eq("hospice_account", options.hospiceAccount);
  }
  const ordersResult = await ordersQuery;
  if (ordersResult.error) throw ordersResult.error;
  const orders = (ordersResult.data ?? []) as OrderRow[];

  const hcpcs = [...new Set(orders.flatMap((order) => itemHcpcs(order.items)))];
  const serialized = new Set<string>();
  if (hcpcs.length > 0) {
    const catalogResult = await supabase
      .from("equipment_catalog")
      .select("hcpcs")
      .in("hcpcs", hcpcs)
      .eq("serialized", true);
    if (catalogResult.error) throw catalogResult.error;
    for (const item of catalogResult.data ?? []) serialized.add(item.hcpcs);
  }

  const pickupOrders: OrderRow[] = [];
  let ordersProcessed = 0;
  for (const order of orders) {
    const externalId = options.externalId ? `${options.externalId}:${order.id}` : undefined;
    if (externalId && options.doneExternalIds?.has(externalId)) continue;
    ordersProcessed += 1;
    await appendStatusEvent(order.id, status, at, actor, externalId);

    // Pickup only for a serialized rental that has actually been delivered (engine §1.4) —
    // never for pickup_triggered/ordered/dispatched orders, which would double-request.
    const needsPickup =
      (status === "deceased" || status === "discharged") &&
      order.status === "delivered" &&
      itemHcpcs(order.items).some((code) => serialized.has(code));
    if (!needsPickup) continue;

    await appendEvent(order.id, "pickup_requested", {
      notified_vendor_ids: order.vendor_id ? [order.vendor_id] : [],
      requested_at: at,
    }, actor);
    const pickupUpdate = await supabase
      .from("orders")
      .update({ pickup_requested_at: at })
      .eq("id", order.id);
    if (pickupUpdate.error) throw pickupUpdate.error;
    pickupOrders.push(order);
  }

  const vendorOrders = new Map<string, OrderRow>();
  for (const order of pickupOrders) {
    if (order.vendor_id && !vendorOrders.has(order.vendor_id)) {
      vendorOrders.set(order.vendor_id, order);
    }
  }
  for (const order of vendorOrders.values()) {
    await appendEvent(order.id, "message_sent", {
      kind: "vendor_notice",
      stub: "Message sending arrives with the comms lane",
      message_id: null,
    }, actor);
  }

  return {
    patient: patientResult.data,
    ordersAffected: orders.length,
    ordersProcessed,
    pickupsRequested: pickupOrders.length,
    vendorsNotified: vendorOrders.size,
    at,
  };
}
