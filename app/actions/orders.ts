"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import { runRules } from "@/src/lib/rules";
import { isPickupOrder, pickBackupVendor } from "../(hospice)/orders/data";
import { orderItems } from "../(hospice)/patients/data";

export type OrderActionState = { ok: boolean; message: string };

const NO_ENV = "Supabase key not set";
const NOT_FOUND = "We couldn't find that order.";

function configured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/today");
  revalidatePath("/readiness");
  revalidatePath("/patients");
}

/** Rules are advisory here — a failed re-run must not lose the event we just wrote. */
async function rerunRules(orderId: string) {
  try {
    await runRules(orderId);
  } catch {
    // The next poll or clock advance re-runs them.
  }
}

export async function escalateOrder(
  orderId: string,
  reason: string,
): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are before escalating." };
  if (!orderId.trim()) return { ok: false, message: NOT_FOUND };
  if (!configured()) return { ok: false, message: NO_ENV };

  const cleanReason = reason.trim() || "Escalated for a decision.";
  try {
    await appendEvent(orderId, "escalated", { reason: cleanReason }, actor);
  } catch {
    return { ok: false, message: "We couldn't escalate this order. Try again." };
  }
  await rerunRules(orderId);
  refresh(orderId);
  revalidatePath("/approvals");
  return { ok: true, message: "Sent to the Director of Nursing." };
}

/**
 * Engine §1.1 reorderToBackup. `reordered` on the old order links to the new one;
 * the new order carries its own `order_placed`. No message is sent from here —
 * vendor comms live in the comms lane.
 */
export async function reorderToBackup(orderId: string): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are before reordering." };
  if (!orderId.trim()) return { ok: false, message: NOT_FOUND };
  if (!configured()) return { ok: false, message: NO_ENV };

  let newOrderId: string;
  try {
    const { supabase } = await import("@/src/lib/supabase");
    const order = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (order.error || !order.data) return { ok: false, message: NOT_FOUND };
    const row = order.data;

    const events = await supabase.from("order_events").select("type").eq("order_id", orderId);
    if (events.error) return { ok: false, message: "We couldn't read this order. Try again." };
    if (isPickupOrder(row, events.data ?? [])) {
      return {
        ok: false,
        message: "Pickups are not rerouted. The owning vendor retrieves its own equipment.",
      };
    }

    const backup = await pickBackupVendor(supabase, row);
    if (!backup) {
      return { ok: false, message: "No other contracted vendor carries every item. Ask your DON." };
    }

    const siblings = await supabase
      .from("orders")
      .select("order_no")
      .like("order_no", `${row.order_no}-R%`);
    const orderNo = `${row.order_no}-R${(siblings.data?.length ?? 0) + 1}`;

    const created = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        patient_id: row.patient_id,
        vendor_id: backup.vendorId,
        hospice_account: row.hospice_account,
        urgency: row.urgency,
        items: row.items,
        price_cents: backup.monthlyPriceCents,
        target_at: row.target_at,
        ordered_by: actor.userName,
        ordered_by_role: actor.role,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return { ok: false, message: "We couldn't create the backup order. Try again." };
    }
    newOrderId = created.data.id;

    await appendEvent(
      newOrderId,
      "order_placed",
      {
        items: orderItems(row.items),
        urgency: row.urgency,
        target_at: row.target_at,
        vendor_id: backup.vendorId,
        replaces: orderId,
        reason: "escalation",
      },
      actor,
    );
    await appendEvent(
      orderId,
      "reordered",
      {
        reason: "escalation",
        replaced_by: newOrderId,
        from_vendor_id: row.vendor_id,
        to_vendor_id: backup.vendorId,
      },
      actor,
    );
  } catch {
    return { ok: false, message: "We couldn't reorder from the backup vendor. Try again." };
  }

  await rerunRules(orderId);
  await rerunRules(newOrderId);
  refresh(orderId);
  refresh(newOrderId);

  redirect(`/orders/${newOrderId}`);
}
