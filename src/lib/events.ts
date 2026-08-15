// Engine write primitive per engine.md §0.1 — implemented by V7; T-lane owns evolution, coordinate before changing.
import "server-only";

import type { EventType, OrderStatus } from "@/src/lib/domain";
import type { Role } from "@/src/lib/role";
import type { Database, Json } from "@/src/types/db";

export type Actor = { role: Role; userName: string };
export type Payload<T extends EventType> = T extends EventType ? Json : never;
export type OrderEvent = Database["public"]["Tables"]["order_events"]["Row"];

// deriveStatus lives here with appendEvent; T3's derive.ts handles badges/scores — do not re-implement either.
export function deriveStatus(events: Pick<OrderEvent, "type">[]): OrderStatus {
  let hasOrderPlaced = false;
  let hasDispatched = false;
  let hasDelivered = false;
  let hasPickupTriggered = false;
  let hasPickedUp = false;
  let hasInTransit = false;
  let dispatchedSeen = false;

  for (const event of events) {
    if (event.type === "order_placed") hasOrderPlaced = true;
    if (event.type === "dispatched") {
      hasDispatched = true;
      dispatchedSeen = true;
    }
    if (dispatchedSeen && (event.type === "gps_opted_in" || event.type === "eta_updated")) {
      hasInTransit = true;
    }
    if (event.type === "delivered") hasDelivered = true;
    if (event.type === "pickup_requested" || event.type === "pickup_scheduled") {
      hasPickupTriggered = true;
    }
    if (event.type === "picked_up") hasPickedUp = true;
  }

  if (hasPickedUp) return "picked_up";
  if (hasPickupTriggered) return "pickup_triggered";
  if (hasDelivered) return "delivered";
  if (hasInTransit) return "in_transit";
  if (hasDispatched) return "dispatched";
  if (hasOrderPlaced) return "ordered";
  return "ordered";
}

export type AppendEventOptions = { externalId?: string };

export async function appendEvent<T extends EventType>(
  orderId: string, type: T, payload: Payload<T>, actor: Actor, opts?: AppendEventOptions
): Promise<OrderEvent> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }
  const { supabase } = await import("@/src/lib/supabase");
  const { now } = await import("@/src/lib/clock");
  const inserted = await supabase.from("order_events").insert({
    order_id: orderId, type, payload, actor: actor.userName, actor_role: actor.role,
    created_at: (await now()).toISOString(),
    ...(opts?.externalId ? { external_id: opts.externalId } : {}),
  }).select("*").single();
  if (inserted.error) throw inserted.error;

  const log = await supabase.from("order_events").select("type")
    .eq("order_id", orderId).order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (log.error) throw log.error;
  const updated = await supabase.from("orders")
    .update({ status: deriveStatus(log.data ?? []) }).eq("id", orderId);
  if (updated.error) throw updated.error;
  return inserted.data;
}
