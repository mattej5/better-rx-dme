"use server";

import { revalidatePath } from "next/cache";
import { loadSettings } from "../(hospice)/settings/data";
import { awaitingApproval } from "@/src/lib/derive";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import type { Database } from "@/src/types/db";

export type ApprovalActionState = { ok: boolean; message: string };

type OrderRow = Pick<Database["public"]["Tables"]["orders"]["Row"], "id" | "vendor_id" | "price_cents">;

export async function getPendingApprovalCount(): Promise<number | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { supabase } = await import("@/src/lib/supabase");
    const result = await supabase.from("order_events").select("order_id,type,created_at")
      .in("type", ["approval_requested", "approved", "denied"])
      .order("created_at", { ascending: true });
    if (result.error) return null;
    const events = new Map<string, typeof result.data>();
    for (const event of result.data ?? []) {
      const list = events.get(event.order_id) ?? [];
      list.push(event);
      events.set(event.order_id, list);
    }
    return [...events.values()].filter(awaitingApproval).length;
  } catch {
    return null;
  }
}

async function canDecide(orderId: string): Promise<ApprovalActionState | null> {
  if (!orderId.trim()) return { ok: false, message: "Order not found" };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: "Supabase key not set" };
  }
  try {
    const { supabase } = await import("@/src/lib/supabase");
    const result = await supabase.from("order_events").select("type,created_at")
      .eq("order_id", orderId).order("created_at", { ascending: true });
    if (result.error) return { ok: false, message: "Approval could not be loaded" };
    if (!awaitingApproval(result.data ?? [])) {
      return { ok: false, message: "This order is no longer awaiting approval" };
    }
    return null;
  } catch {
    return { ok: false, message: "Approval could not be loaded" };
  }
}

function refresh(orderId: string) {
  revalidatePath("/approvals");
  revalidatePath("/today");
  revalidatePath(`/orders/${orderId}`);
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const { supabase } = await import("@/src/lib/supabase");
  const result = await supabase.from("orders").select("id,vendor_id,price_cents").eq("id", orderId).maybeSingle();
  if (result.error || !result.data) return null;
  return result.data;
}

export async function approveOrder(
  orderId: string,
  note?: string,
): Promise<ApprovalActionState> {
  const actor = await getSession();
  if (!actor || actor.role !== "don") {
    return { ok: false, message: "Only the Director of Nursing can approve orders" };
  }
  const refusal = await canDecide(orderId);
  if (refusal) return refusal;
  try {
    const order = await loadOrder(orderId);
    const settings = await loadSettings();
    const priceCents = order?.price_cents ?? 0;
    const thresholdCents = settings.values.don_threshold_cents;
    await appendEvent(orderId, "approved", {
      price_cents: priceCents,
      threshold_cents: thresholdCents,
      ...(note?.trim() ? { reason: note.trim() } : {}),
    }, actor);

    if (!order?.vendor_id) {
      refresh(orderId);
      return { ok: true, message: "Order approved. A vendor still needs to be chosen before it can be sent." };
    }

    try {
      await appendEvent(orderId, "vendor_notified", {
        vendor_id: order.vendor_id,
        channel: "sms",
        nudge: false,
        stub: "Message sending arrives with the comms lane",
      }, actor);
    } catch {
      refresh(orderId);
      return { ok: true, message: "Approved. Vendor notification failed. Retry from the order page." };
    }

    refresh(orderId);
    return { ok: true, message: "Order approved" };
  } catch {
    return { ok: false, message: "Order could not be approved" };
  }
}

export async function denyOrder(
  orderId: string,
  reason: string,
): Promise<ApprovalActionState> {
  const actor = await getSession();
  if (!actor || actor.role !== "don") {
    return { ok: false, message: "Only the Director of Nursing can deny orders" };
  }
  const cleanReason = reason.trim();
  if (!cleanReason) return { ok: false, message: "Enter a reason for the nurse" };
  const refusal = await canDecide(orderId);
  if (refusal) return refusal;
  try {
    const order = await loadOrder(orderId);
    const settings = await loadSettings();
    await appendEvent(orderId, "denied", {
      price_cents: order?.price_cents ?? 0,
      threshold_cents: settings.values.don_threshold_cents,
      reason: cleanReason,
    }, actor);
    refresh(orderId);
    return { ok: true, message: "Order denied" };
  } catch {
    return { ok: false, message: "Order could not be denied" };
  }
}
