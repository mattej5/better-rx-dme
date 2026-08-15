/**
 * `notifyVendor()` — the one place the product turns "this vendor needs to know
 * about this order" into an actual outbound message. Named in the comment at the
 * top of `app/api/vendor/link/route.ts`, which expected exactly this caller.
 *
 * It composes three seams that already exist and re-implements none of them:
 *   `issueMagicLink()` (N6) mints the tap-target the vendor gets,
 *   `renderTemplate()` (N3) owns the copy,
 *   `sendMessage()` (N2) owns transport AND appends the `message_sent` event.
 *
 * Callers therefore append `vendor_notified` (the domain fact) and let this
 * function produce the single `message_sent` (the comms fact). Nobody appends
 * `message_sent` by hand.
 *
 * Never throws. A vendor who cannot be reached must not roll back an order that
 * was genuinely placed; the failure is recorded on the timeline by
 * `sendMessage()` and returned here as null.
 */

import { formatDayTime } from "./domain.ts";
import { issueMagicLink } from "./magic-link.ts";
import { nudgeTimeVars } from "./nudge-ladder.ts";
import { sendMessage, type Actor, type SendResult } from "./messaging.ts";
import type { Database } from "@/src/types/db";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** "Denver 80205" — enough for a dispatcher to judge the trip, no street. */
function areaOf(address: unknown): string {
  const a = record(address);
  return [text(a.city), text(a.zip)].filter(Boolean).join(" ") || "the service area";
}

function fullAddress(address: unknown): string {
  const a = record(address);
  const tail = [text(a.city), text(a.state)].filter(Boolean).join(", ");
  return (
    [text(a.street1), [tail, text(a.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", ") ||
    "the patient's home"
  );
}

function itemSummary(items: OrderRow["items"]): string {
  if (!Array.isArray(items)) return "equipment";
  const parts = items.flatMap((raw) => {
    const rec = record(raw);
    const name = text(rec.plain_name) ?? text(rec.hcpcs);
    if (!name) return [];
    const qty = typeof rec.qty === "number" && rec.qty > 1 ? `${rec.qty} × ` : "";
    return [`${qty}${name}`];
  });
  return parts.length > 0 ? parts.join(", ") : "equipment";
}

/** Vendors are reachable by SMS first; email is the ADR 0005 stand-in. */
function recipient(vendor: VendorRow): { channel: "sms" | "email"; address: string; label: string } | null {
  if (vendor.dispatch_phone) {
    return { channel: "sms", address: vendor.dispatch_phone, label: vendor.name };
  }
  if (vendor.dispatch_email) {
    return { channel: "email", address: vendor.dispatch_email, label: vendor.name };
  }
  return null;
}

export type NotifyVendorInput = {
  orderId: string;
  vendorId: string;
  /**
   * `vendor_notify` for a new order, `vendor_pickup` after a death or
   * discharge, `vendor_nudge` to chase silence.
   */
  template: "vendor_notify" | "vendor_pickup" | "vendor_nudge";
  actor: Actor;
  /** Defaults to the order's `pickup_requested_at`, then to now. Pickup copy only. */
  notifiedAt?: string;
  /**
   * Rungs 1 to 3 (amendment 9). Steps 4 and 5 send the vendor nothing, so the
   * ladder marker is clamped rather than passed through and thrown on.
   */
  ladderStep?: number;
};

/**
 * Sends one message to one vendor about one order. Returns the send result, or
 * null when there was nothing to send to (no vendor row, no contact details) or
 * the send could not be attempted. Exactly one `message_sent` event results,
 * written by `sendMessage()`.
 */
export async function notifyVendor(input: NotifyVendorInput): Promise<SendResult | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const { supabase } = await import("./supabase.ts");

    const [vendorResult, orderResult] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", input.vendorId).maybeSingle(),
      supabase.from("orders").select("*").eq("id", input.orderId).maybeSingle(),
    ]);
    if (vendorResult.error || !vendorResult.data) return null;
    if (orderResult.error || !orderResult.data) return null;

    const vendor = vendorResult.data;
    const order = orderResult.data;
    const to = recipient(vendor);
    if (!to) return null;

    const patientResult = await supabase
      .from("patients")
      .select("hospice_name,address")
      .eq("id", order.patient_id)
      .maybeSingle();
    const patient = patientResult.data ?? null;

    const issuedAt = new Date();
    const link = await issueMagicLink(
      { vendorId: input.vendorId, scope: "stop", orderId: input.orderId },
      issuedAt,
    );
    const url = `${appBaseUrl()}${link.path}`;

    const step = Math.min(3, Math.max(1, Math.trunc(input.ladderStep ?? 1))) as 1 | 2 | 3;
    const neededBy = order.target_at ? formatDayTime(order.target_at) : "as soon as you can";

    const vars: Record<string, string> =
      input.template === "vendor_nudge"
        ? {
            ladder_step: String(step),
            hospice: patient?.hospice_name ?? "the hospice",
            item_short: itemSummary(order.items),
            area: areaOf(patient?.address),
            needed_by: neededBy,
            link: url,
            ...nudgeTimeVars(order.target_at ?? issuedAt.toISOString(), issuedAt),
          }
        : input.template === "vendor_pickup"
        ? {
            address: fullAddress(patient?.address),
            items: itemSummary(order.items),
            notified_at: formatDayTime(
              input.notifiedAt ?? order.pickup_requested_at ?? issuedAt.toISOString(),
            ),
            link: url,
            ...(vendor.hazmat_certified && /oxygen|concentrator/i.test(itemSummary(order.items))
              ? { oxygen: "true" }
              : {}),
          }
        : {
            hospice: patient?.hospice_name ?? "the hospice",
            item_summary: itemSummary(order.items),
            area: areaOf(patient?.address),
            needed_by: neededBy,
            link: url,
          };

    // Transport is selectTransport()'s decision, not ours. Synthetic 555-01XX
    // vendor numbers degrade to a logged message there; a real number sends.
    return await sendMessage(
      { orderId: input.orderId, to, template: input.template, vars },
      {
        actor: input.actor,
        vendorId: input.vendorId,
        ...(input.template === "vendor_nudge"
          ? { marker: { kind: "nudge" as const, ladder_step: step } }
          : {}),
      },
    );
  } catch (error) {
    console.error(
      `[notify-vendor] could not notify vendor ${input.vendorId} about order ${input.orderId}:`,
      error,
    );
    return null;
  }
}
