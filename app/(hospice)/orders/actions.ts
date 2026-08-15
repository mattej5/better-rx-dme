"use server";

import { revalidatePath } from "next/cache";
import { now } from "@/src/lib/clock";
import { appendEvent } from "@/src/lib/events";
import { getSession } from "@/src/lib/role";
import { runRules } from "@/src/lib/rules";
import { applyParsedIntent } from "@/src/lib/apply-parse";
import {
  parseVendorReply,
  type OrderContext,
  type ParseResult,
} from "@/src/lib/parse-vendor-reply";

export type OrderActionState = { ok: boolean; message: string };

const NO_DB: OrderActionState = {
  ok: false,
  message: "Not connected to the database, so nothing was written.",
};

function hasDb(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/today");
  revalidatePath("/readiness");
  revalidatePath("/pickups");
}

async function runRulesQuietly(orderId: string) {
  try {
    await runRules(orderId);
  } catch {
    // Rules are advisory on a manual action; never lose the append over them.
  }
}

/**
 * Manual nudge. engine.md §2.6: there is no `nudge_sent` event — a nudge is a
 * `message_sent` carrying `kind:'nudge'` and its ladder step, so ladder state stays
 * derivable by counting and stays idempotent under clock jumps.
 */
export async function nudgeVendor(orderId: string): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are first." };
  if (!hasDb()) return NO_DB;

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const [orderRes, eventsRes] = await Promise.all([
      supabase.from("orders").select("id,vendor_id,status").eq("id", orderId).maybeSingle(),
      supabase.from("order_events").select("type,payload").eq("order_id", orderId),
    ]);
    if (orderRes.error || !orderRes.data) return { ok: false, message: "Order not found." };

    const steps = (eventsRes.data ?? []).filter((e) => {
      if (e.type !== "message_sent") return false;
      const payload = e.payload as Record<string, unknown> | null;
      return payload?.kind === "nudge";
    }).length;

    if (!orderRes.data.vendor_id) {
      return { ok: false, message: "This order has no vendor yet, so there is nobody to remind." };
    }

    // sendMessage() writes the one message_sent, carrying the nudge marker so
    // ladder state stays derivable by counting (amendment 9).
    const { notifyVendor } = await import("@/src/lib/notify-vendor");
    const sent = await notifyVendor({
      orderId,
      vendorId: orderRes.data.vendor_id,
      template: "vendor_nudge",
      actor,
      ladderStep: steps + 1,
    });
    if (!sent) return { ok: false, message: "We couldn't send that reminder. Try again." };

    await runRulesQuietly(orderId);
    refresh(orderId);
    return {
      ok: true,
      message:
        sent.status === "sent"
          ? "Reminder sent to the vendor."
          : "Reminder recorded. Nothing was actually texted, this vendor has a sample phone number.",
    };
  } catch {
    return { ok: false, message: "We couldn't send that reminder. Try again." };
  }
}

export async function escalateOrder(
  orderId: string,
  reason: string,
): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are first." };
  const clean = reason.trim();
  if (!clean) return { ok: false, message: "Say what the Director of Nursing needs to know." };
  if (!hasDb()) return NO_DB;

  try {
    await appendEvent(orderId, "escalated", { reason: clean, to: "don" }, actor);
    await runRulesQuietly(orderId);
    refresh(orderId);
    revalidatePath("/approvals");
    return { ok: true, message: "Sent to the Director of Nursing." };
  } catch {
    return { ok: false, message: "We couldn't escalate this. Try again." };
  }
}

/**
 * engine.md §1.1 + addendum #7. Deliveries only: a pickup cannot be rerouted to a
 * backup vendor, because the vendor that owns the equipment is the one that has to
 * retrieve it. Nothing auto-cancels — this only runs on a human tap.
 */
export async function reorderToBackup(
  orderId: string,
  newVendorId: string,
): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are first." };
  if (!newVendorId) return { ok: false, message: "Pick a backup vendor." };
  if (!hasDb()) return NO_DB;

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const orderRes = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (orderRes.error || !orderRes.data) return { ok: false, message: "Order not found." };
    const order = orderRes.data;

    if (order.status === "pickup_triggered" || order.status === "picked_up") {
      return {
        ok: false,
        message:
          "A pickup stays with the vendor that owns the equipment. Send a reminder or escalate instead.",
      };
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const codes = items.flatMap((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const hcpcs = (raw as Record<string, unknown>).hcpcs;
      return typeof hcpcs === "string" ? [hcpcs] : [];
    });

    const pricesRes = await supabase
      .from("vendor_prices")
      .select("hcpcs,price_cents")
      .eq("vendor_id", newVendorId)
      .in("hcpcs", codes);
    if (pricesRes.error) return { ok: false, message: "We couldn't read that vendor's prices." };
    const priceByCode = new Map((pricesRes.data ?? []).map((p) => [p.hcpcs, p.price_cents]));
    if (codes.some((c) => !priceByCode.has(c))) {
      return { ok: false, message: "That vendor does not carry every item on this order." };
    }

    const priceCents = items.reduce<number>((sum, raw) => {
      const rec = (raw ?? {}) as Record<string, unknown>;
      const hcpcs = typeof rec.hcpcs === "string" ? rec.hcpcs : null;
      const qty = typeof rec.qty === "number" ? rec.qty : 1;
      return sum + (hcpcs ? (priceByCode.get(hcpcs) ?? 0) * qty : 0);
    }, 0);

    const latestRes = await supabase
      .from("orders")
      .select("order_no")
      .like("order_no", "DME-%")
      .order("order_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const parsed = Number.parseInt((latestRes.data?.order_no ?? "").replace(/^DME-/, ""), 10);
    const orderNo = `DME-${(Number.isFinite(parsed) ? parsed : 10_400) + 1}`;

    const placedAt = await now();
    const inserted = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        patient_id: order.patient_id,
        vendor_id: newVendorId,
        status: "ordered",
        urgency: order.urgency,
        items: order.items,
        price_cents: priceCents,
        ordered_at: placedAt.toISOString(),
        target_at: order.target_at,
        ordered_by: actor.userName,
        ordered_by_role: actor.role,
      })
      .select("id,order_no")
      .single();
    if (inserted.error || !inserted.data) {
      return { ok: false, message: "We couldn't create the backup order. Nothing changed." };
    }

    await appendEvent(
      orderId,
      "reordered",
      {
        from_vendor_id: order.vendor_id,
        to_vendor_id: newVendorId,
        reason: "at_risk",
        replaced_by: inserted.data.id,
        human_confirmed: true,
      },
      actor,
    );
    await appendEvent(
      inserted.data.id,
      "order_placed",
      {
        items: order.items,
        urgency: order.urgency,
        target_at: order.target_at,
        vendor_id: newVendorId,
        price_cents: priceCents,
        replaces: orderId,
      },
      actor,
    );
    await appendEvent(
      inserted.data.id,
      "vendor_notified",
      { vendor_id: newVendorId, channel: "sms", nudge: false },
      actor,
    );
    // sendMessage() writes the one message_sent; nothing is appended for it here.
    const { notifyVendor } = await import("@/src/lib/notify-vendor");
    await notifyVendor({
      orderId: inserted.data.id,
      vendorId: newVendorId,
      template: "vendor_notify",
      actor,
    });

    await runRulesQuietly(orderId);
    await runRulesQuietly(inserted.data.id);
    refresh(orderId);
    revalidatePath(`/orders/${inserted.data.id}`);
    return { ok: true, message: `${inserted.data.order_no} placed with the backup vendor.` };
  } catch {
    return { ok: false, message: "We couldn't reorder from the backup. Try again." };
  }
}

/**
 * The human half of the confidence gate (engine.md §3.4). A parse under 0.75 changes
 * nothing on its own; this is what runs when a nurse reads the interpretation and taps
 * to accept it. The message is re-parsed here rather than trusting anything the client
 * sends, and the resulting event records that a person confirmed it.
 */
export async function confirmParsedReply(
  orderId: string,
  messageId: string,
): Promise<OrderActionState> {
  const actor = await getSession();
  if (!actor) return { ok: false, message: "Choose who you are first." };
  if (!hasDb()) return NO_DB;

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const [messageRes, orderRes] = await Promise.all([
      supabase.from("messages").select("*").eq("id", messageId).maybeSingle(),
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
    ]);
    if (messageRes.error || !messageRes.data) return { ok: false, message: "Message not found." };
    if (orderRes.error || !orderRes.data) return { ok: false, message: "Order not found." };
    const order = orderRes.data;

    const vendorRes = order.vendor_id
      ? await supabase.from("vendors").select("name").eq("id", order.vendor_id).maybeSingle()
      : null;

    const context: OrderContext = {
      orderId: order.id,
      item: "equipment",
      patientArea: "the area",
      neededBy: order.target_at ?? order.ordered_at,
      urgency: order.urgency,
      vendorName: vendorRes?.data?.name ?? "the vendor",
    };
    // Re-parsed here rather than trusting anything the client sent. It uses the
    // full seam, not the regex pass alone: the replies that reach this button are
    // exactly the ones the regex could not read, so a regex-only re-parse would
    // refuse every message the nurse was asked to confirm.
    const result: ParseResult = await parseVendorReply(messageRes.data.body, context);

    const applied = await applyParsedIntent({
      orderId,
      vendorId: order.vendor_id,
      messageId,
      result,
      actor,
      humanConfirmed: true,
    });
    if (!applied.applied) return { ok: false, message: applied.reason };

    await runRulesQuietly(orderId);
    refresh(orderId);
    return { ok: true, message: "Applied to the order." };
  } catch {
    return { ok: false, message: "We couldn't apply that. Try again." };
  }
}
