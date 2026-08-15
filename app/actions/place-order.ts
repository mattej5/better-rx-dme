"use server";

import { revalidatePath } from "next/cache";
import { loadSettings } from "../(hospice)/settings/data";
import { now } from "@/src/lib/clock";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import { runRules } from "@/src/lib/rules";
import type { OrderUrgency } from "@/src/lib/domain";

export type PlaceOrderItem = { hcpcs: string; plainName: string; qty: number };

export type PlaceOrderInput = {
  patientId: string;
  vendorId: string;
  urgency: OrderUrgency;
  /** ISO. Becomes orders.target_at — "needed by" (contracts amendment 4). */
  targetAt: string;
  reason?: string;
  items: PlaceOrderItem[];
};

export type PlacedOrder = {
  id: string;
  orderNo: string;
  plainName: string;
  priceCents: number;
  awaitingApproval: boolean;
};

export type PlaceOrderResult =
  | { ok: true; orders: PlacedOrder[]; anyAwaitingApproval: boolean }
  | { ok: false; message: string };

function nextOrderNo(latest: string | null | undefined, offset: number): string {
  const parsed = latest ? Number.parseInt(latest.replace(/^DME-/, ""), 10) : NaN;
  const base = Number.isFinite(parsed) ? parsed : 10_400;
  return `DME-${base + 1 + offset}`;
}

/**
 * specs/engine.md §1.1. One order per item (contracts amendment 3 — the admission
 * bundle has no bundle_id; the UI groups by shared placement time). Each order runs
 * the DON-threshold branch on its own line total: at or above the threshold we emit
 * `approval_requested` and stop, and the vendor hears nothing until a DON approves.
 * STAT does not bypass this.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are before ordering." };
  if (input.items.length === 0) return { ok: false, message: "Pick at least one item." };
  if (!input.vendorId) return { ok: false, message: "Pick a vendor." };
  if (Number.isNaN(Date.parse(input.targetAt))) {
    return { ok: false, message: "Pick the time it has to be there." };
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      message: "Not connected to the database, so nothing was written. Nothing was ordered.",
    };
  }

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const settings = await loadSettings();
    const thresholdCents = settings.values.don_threshold_cents;
    const placedAt = await now();

    const priceRes = await supabase
      .from("vendor_prices")
      .select("hcpcs,price_cents")
      .eq("vendor_id", input.vendorId)
      .in("hcpcs", input.items.map((i) => i.hcpcs));
    if (priceRes.error) return { ok: false, message: "We couldn't read this vendor's prices." };
    const priceByCode = new Map((priceRes.data ?? []).map((r) => [r.hcpcs, r.price_cents]));

    const missing = input.items.filter((i) => !priceByCode.has(i.hcpcs));
    if (missing.length > 0) {
      return {
        ok: false,
        message: `This vendor does not carry ${missing.map((m) => m.plainName).join(", ")}.`,
      };
    }

    const latestRes = await supabase
      .from("orders")
      .select("order_no")
      .like("order_no", "DME-%")
      .order("order_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    const placed: PlacedOrder[] = [];

    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index];
      const unitCents = priceByCode.get(item.hcpcs) ?? 0;
      const lineCents = unitCents * item.qty;
      const itemsJson = [{ hcpcs: item.hcpcs, plain_name: item.plainName, qty: item.qty }];

      const inserted = await supabase
        .from("orders")
        .insert({
          order_no: nextOrderNo(latestRes.data?.order_no ?? null, index),
          patient_id: input.patientId,
          vendor_id: input.vendorId,
          status: "ordered",
          urgency: input.urgency,
          items: itemsJson,
          price_cents: lineCents,
          ordered_at: placedAt.toISOString(),
          target_at: input.targetAt,
          ordered_by: actor.userName,
          ordered_by_role: actor.role,
        })
        .select("id,order_no")
        .single();
      if (inserted.error || !inserted.data) {
        return {
          ok: false,
          message:
            placed.length === 0
              ? "We couldn't place this order. Nothing was written."
              : `We placed ${placed.length} of ${input.items.length} orders. Try the rest again.`,
        };
      }

      const orderId = inserted.data.id;

      await appendEvent(
        orderId,
        "order_placed",
        {
          items: itemsJson,
          urgency: input.urgency,
          target_at: input.targetAt,
          vendor_id: input.vendorId,
          price_cents: lineCents,
          ...(input.reason?.trim() ? { note: input.reason.trim() } : {}),
        },
        actor,
      );

      // THE branch. Threshold is read from the settings table, never hardcoded.
      const overThreshold = lineCents >= thresholdCents;
      if (overThreshold) {
        await appendEvent(
          orderId,
          "approval_requested",
          {
            price_cents: lineCents,
            threshold_cents: thresholdCents,
            vendor_id: input.vendorId,
            urgency: input.urgency,
          },
          actor,
        );
      } else {
        // STUB pending src/lib/messaging.ts (comms lane). engine.md §1.1 routes this
        // through notifyVendor() → sendMessage(); the two events it appends are the
        // same two appended here, so swapping in the seam is a body change.
        await appendEvent(
          orderId,
          "vendor_notified",
          { vendor_id: input.vendorId, channel: "sms", nudge: false },
          actor,
        );
        await appendEvent(
          orderId,
          "message_sent",
          {
            vendor_id: input.vendorId,
            kind: "notify",
            template: "vendor_notify",
            channel: "sms",
            stub: "Message sending arrives with the comms lane",
          },
          actor,
        );
      }

      try {
        await runRules(orderId);
      } catch {
        // Rules are advisory here; a rules failure must not lose a placed order.
      }

      placed.push({
        id: orderId,
        orderNo: inserted.data.order_no,
        plainName: item.plainName,
        priceCents: lineCents,
        awaitingApproval: overThreshold,
      });
    }

    revalidatePath("/today");
    revalidatePath("/readiness");
    revalidatePath("/approvals");
    revalidatePath(`/patients/${input.patientId}`);

    return {
      ok: true,
      orders: placed,
      anyAwaitingApproval: placed.some((o) => o.awaitingApproval),
    };
  } catch {
    return { ok: false, message: "We couldn't place this order. Try again." };
  }
}
