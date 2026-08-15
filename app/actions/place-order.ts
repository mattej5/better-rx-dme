"use server";

import { revalidatePath } from "next/cache";

import { loadSettings } from "../(hospice)/settings/data";
import { now } from "@/src/lib/clock";
import { ORDER_URGENCIES, type OrderUrgency } from "@/src/lib/domain";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import { runRules } from "@/src/lib/rules";

export type PlaceOrderItem = { hcpcs: string; qty: number };

export type PlaceOrderInput = {
  patientId: string;
  vendorId: string;
  urgency: OrderUrgency;
  /** ISO instant the equipment must arrive by (orders.target_at). */
  targetAt: string;
  items: PlaceOrderItem[];
};

export type PlaceOrderResult =
  | { ok: true; orderIds: string[]; needsApproval: boolean; redirectTo: string }
  | { ok: false; message: string };

const HOSPICE_ACCOUNT = "ACCT-001";

function nextOrderNo(existing: string[]): number {
  let highest = 10000;
  for (const value of existing) {
    const digits = Number(value.slice(4));
    if (Number.isFinite(digits) && digits > highest) highest = digits;
  }
  return highest + 1;
}

/**
 * engine.md §1.1 threshold branch, read as the submitted monthly total: the seeded
 * catalog has no single line at or above $500, so a per-line test could never send
 * anything to the DON. Contracts amendment 3 still applies — one order per item.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: "We couldn't reach the order system. Try again." };
  }
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are before ordering." };

  const items = input.items.filter((item) => item.hcpcs && item.qty > 0);
  if (items.length === 0) return { ok: false, message: "Pick at least one item." };
  if (!ORDER_URGENCIES.includes(input.urgency)) {
    return { ok: false, message: "Choose when this is needed." };
  }
  const targetMs = Date.parse(input.targetAt);
  if (Number.isNaN(targetMs)) return { ok: false, message: "Choose a needed-by date and time." };
  if (!input.vendorId) return { ok: false, message: "Choose a vendor." };

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const hcpcs = items.map((item) => item.hcpcs);
    const [catalog, prices, settings, virtualNow, numbers] = await Promise.all([
      supabase.from("equipment_catalog").select("hcpcs,plain_name").in("hcpcs", hcpcs),
      supabase.from("vendor_prices").select("hcpcs,price_cents").eq("vendor_id", input.vendorId).in("hcpcs", hcpcs),
      loadSettings(),
      now(),
      supabase.from("orders").select("order_no").like("order_no", "DME-%"),
    ]);
    if (catalog.error || prices.error || numbers.error) {
      return { ok: false, message: "We couldn't price this order. Try again." };
    }

    const plainNames = new Map((catalog.data ?? []).map((row) => [row.hcpcs, row.plain_name]));
    const priceByHcpcs = new Map((prices.data ?? []).map((row) => [row.hcpcs, row.price_cents]));
    if (items.some((item) => !priceByHcpcs.has(item.hcpcs))) {
      return { ok: false, message: "That vendor no longer carries every item. Pick another vendor." };
    }

    const lines = items.map((item) => ({
      hcpcs: item.hcpcs,
      plain_name: plainNames.get(item.hcpcs) ?? item.hcpcs,
      qty: item.qty,
      price_cents: (priceByHcpcs.get(item.hcpcs) as number) * item.qty,
    }));
    const totalCents = lines.reduce((sum, line) => sum + line.price_cents, 0);
    const thresholdCents = settings.values.don_threshold_cents;
    const needsApproval = totalCents >= thresholdCents;

    const orderedAt = virtualNow.toISOString();
    const targetAt = new Date(targetMs).toISOString();
    let sequence = nextOrderNo((numbers.data ?? []).map((row) => row.order_no));

    const orderIds: string[] = [];
    for (const line of lines) {
      const row = {
        order_no: `DME-${String(sequence).padStart(5, "0")}`,
        patient_id: input.patientId,
        vendor_id: input.vendorId,
        hospice_account: HOSPICE_ACCOUNT,
        urgency: input.urgency,
        target_at: targetAt,
        ordered_at: orderedAt,
        ordered_by: actor.userName,
        ordered_by_role: actor.role,
        price_cents: line.price_cents,
        items: [{ hcpcs: line.hcpcs, plain_name: line.plain_name, qty: line.qty }],
      };
      sequence += 1;

      const inserted = await supabase.from("orders").insert(row).select("id").single();
      if (inserted.error || !inserted.data) {
        return {
          ok: false,
          message: orderIds.length === 0
            ? "We couldn't place this order. Try again."
            : "Some items were ordered and some were not. Check the patient's equipment list.",
        };
      }
      orderIds.push(inserted.data.id);

      await appendEvent(inserted.data.id, "order_placed", {
        target_at: targetAt,
        urgency: input.urgency,
        price_cents: line.price_cents,
        items: [{ hcpcs: line.hcpcs, plain_name: line.plain_name, qty: line.qty }],
      }, actor);

      if (needsApproval) {
        await appendEvent(inserted.data.id, "approval_requested", {
          price_cents: line.price_cents,
          threshold_cents: thresholdCents,
        }, actor);
      } else {
        await appendEvent(inserted.data.id, "vendor_notified", {
          vendor_id: input.vendorId,
          channel: "sms",
          nudge: false,
          stub: "Message sending arrives with the comms lane",
        }, actor);
      }

      await runRules(inserted.data.id);
    }

    revalidatePath("/", "layout");

    const redirectTo = needsApproval
      ? `/patients/${input.patientId}/order/submitted?orders=${orderIds.join(",")}`
      : orderIds.length === 1
        ? `/orders/${orderIds[0]}`
        : `/patients/${input.patientId}`;

    return { ok: true, orderIds, needsApproval, redirectTo };
  } catch {
    return { ok: false, message: "We couldn't place this order. Try again." };
  }
}
