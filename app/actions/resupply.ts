"use server";

import { revalidatePath } from "next/cache";

import { now } from "@/src/lib/clock";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import { placeOrder } from "./place-order";
import { orderItems } from "../(hospice)/patients/data";

export type ResupplyActionState = { ok: boolean; message: string };

const NO_ENV = "We couldn't reach the order system. Try again.";

/**
 * Contracts amendment 5: `resupply_due` is emitted on the reorder against the
 * originating order, so the schedule's own history stays on the order the
 * equipment first came from. When nothing originating exists the event lands on
 * the new order, which keeps `order_events.order_id` NOT NULL either way.
 */
async function cheapestCarrier(hcpcs: string): Promise<string | null> {
  const { supabase } = await import("@/src/lib/supabase");
  const prices = await supabase
    .from("vendor_prices")
    .select("vendor_id,price_cents,in_stock")
    .eq("hcpcs", hcpcs);
  if (prices.error) return null;

  const stocked = (prices.data ?? []).filter((row) => row.in_stock);
  if (stocked.length === 0) return null;

  const vendors = await supabase
    .from("vendors")
    .select("id,status")
    .in("id", stocked.map((row) => row.vendor_id));
  if (vendors.error) return null;
  const active = new Set((vendors.data ?? []).filter((v) => v.status === "active").map((v) => v.id));

  return (
    stocked
      .filter((row) => active.has(row.vendor_id))
      .sort((a, b) => a.price_cents - b.price_cents)[0]?.vendor_id ?? null
  );
}

export async function reorderResupply(scheduleId: string): Promise<ResupplyActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are before reordering." };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: NO_ENV };
  }

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const schedule = await supabase
      .from("resupply_schedules")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();
    if (schedule.error || !schedule.data) {
      return { ok: false, message: "We couldn't find that resupply schedule." };
    }
    const row = schedule.data;

    const priorOrders = await supabase
      .from("orders")
      .select("id,vendor_id,items,ordered_at")
      .eq("patient_id", row.patient_id)
      .order("ordered_at", { ascending: false });
    if (priorOrders.error) {
      return { ok: false, message: "We couldn't read this patient's equipment. Try again." };
    }
    const originating =
      (priorOrders.data ?? []).find((order) =>
        orderItems(order.items).some((item) => item.hcpcs === row.hcpcs),
      ) ?? null;

    const vendorId = originating?.vendor_id ?? (await cheapestCarrier(row.hcpcs));
    if (!vendorId) {
      return { ok: false, message: "No contracted vendor has this item in stock. Ask your DON." };
    }

    const virtualNow = await now();
    const dueMs = Date.parse(row.next_due_at);
    const targetAt = new Date(
      Number.isFinite(dueMs) && dueMs > virtualNow.getTime()
        ? dueMs
        : virtualNow.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();

    const placed = await placeOrder({
      patientId: row.patient_id,
      vendorId,
      urgency: "routine",
      targetAt,
      items: [{ hcpcs: row.hcpcs, qty: 1 }],
    });
    if (!placed.ok) return { ok: false, message: placed.message };

    const newOrderId = placed.orderIds[0];
    await appendEvent(
      originating?.id ?? newOrderId,
      "resupply_due",
      { schedule_id: row.id, hcpcs: row.hcpcs, reorder_order_id: newOrderId },
      actor,
    );

    const advanced = new Date(
      (Number.isFinite(dueMs) ? dueMs : virtualNow.getTime()) +
        row.interval_days * 24 * 60 * 60 * 1000,
    ).toISOString();
    await supabase
      .from("resupply_schedules")
      .update({ next_due_at: advanced })
      .eq("id", row.id);

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: placed.needsApproval
        ? "Reordered. Your Director of Nursing needs to approve it."
        : "Reordered. The vendor has been told.",
    };
  } catch {
    return { ok: false, message: "We couldn't reorder this item. Try again." };
  }
}
