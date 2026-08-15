import "server-only";

import { awaitingApproval } from "@/src/lib/derive";
import { SETTING_DEFAULTS } from "@/src/lib/settings-defaults";
import type { Database } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
type OrderRow = Tables["orders"]["Row"];
type EventRow = Tables["order_events"]["Row"];

type Item = { hcpcs: string; plainName: string; qty: number };
export type ApprovalCardData = {
  orderId: string;
  orderNo: string;
  patientName: string;
  items: Item[];
  vendorName: string;
  monthlyPriceCents: number | null;
  thresholdCents: number;
  alternative: { vendorName: string; monthlyPriceCents: number } | null;
};

export type ApprovalsLoaded =
  | { ok: true; cards: ApprovalCardData[] }
  | { ok: false; reason: "no-env" | "error" };

function parseItems(value: OrderRow["items"]): Item[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.hcpcs !== "string") return [];
    return [{
      hcpcs: item.hcpcs,
      plainName: typeof item.plain_name === "string" ? item.plain_name : item.hcpcs,
      qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1,
    }];
  });
}

export async function loadApprovals(): Promise<ApprovalsLoaded> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: "no-env" };
  }
  try {
    const { supabase } = await import("@/src/lib/supabase");
    const eventResult = await supabase.from("order_events").select("*")
      .in("type", ["approval_requested", "approved", "denied"])
      .order("created_at", { ascending: true });
    if (eventResult.error) return { ok: false, reason: "error" };

    const byOrder = new Map<string, EventRow[]>();
    for (const event of eventResult.data ?? []) {
      const events = byOrder.get(event.order_id) ?? [];
      events.push(event);
      byOrder.set(event.order_id, events);
    }
    const ids = [...byOrder].filter(([, events]) => awaitingApproval(events)).map(([id]) => id);
    if (ids.length === 0) return { ok: true, cards: [] };

    const orderResult = await supabase.from("orders").select("*").in("id", ids)
      .order("ordered_at", { ascending: true });
    if (orderResult.error) return { ok: false, reason: "error" };
    const orders = orderResult.data ?? [];
    const patientIds = [...new Set(orders.map((order) => order.patient_id))];
    const allItems = orders.flatMap((order) => parseItems(order.items));
    const hcpcs = [...new Set(allItems.map((item) => item.hcpcs))];

    const [patients, vendors, catalog, prices, setting] = await Promise.all([
      supabase.from("patients").select("id,first_name,last_name").in("id", patientIds),
      supabase.from("vendors").select("id,name"),
      hcpcs.length ? supabase.from("equipment_catalog").select("hcpcs,plain_name").in("hcpcs", hcpcs) : Promise.resolve({ data: [], error: null }),
      hcpcs.length ? supabase.from("vendor_prices").select("vendor_id,hcpcs,price_cents").in("hcpcs", hcpcs) : Promise.resolve({ data: [], error: null }),
      supabase.from("settings").select("value").eq("key", "don_threshold_cents").maybeSingle(),
    ]);
    if (patients.error || vendors.error) return { ok: false, reason: "error" };

    const patientNames = new Map((patients.data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
    const vendorNames = new Map((vendors.data ?? []).map((v) => [v.id, v.name]));
    const plainNames = new Map((catalog.data ?? []).map((item) => [item.hcpcs, item.plain_name]));
    const priceRows = prices.data ?? [];
    const threshold = typeof setting.data?.value === "number"
      ? setting.data.value
      : SETTING_DEFAULTS.don_threshold_cents;

    const cards = orders.map((order): ApprovalCardData => {
      const items = parseItems(order.items).map((item) => ({
        ...item,
        plainName: item.plainName === item.hcpcs ? (plainNames.get(item.hcpcs) ?? item.hcpcs) : item.plainName,
      }));
      const needed = new Set(items.map((item) => item.hcpcs));
      const pricesByVendor = new Map<string, Map<string, number>>();
      for (const price of priceRows) {
        if (!needed.has(price.hcpcs)) continue;
        const rows = pricesByVendor.get(price.vendor_id) ?? new Map<string, number>();
        rows.set(price.hcpcs, price.price_cents);
        pricesByVendor.set(price.vendor_id, rows);
      }
      const totalFor = (rows: Map<string, number> | undefined): number | null => {
        if (!rows || [...needed].some((code) => !rows.has(code))) return null;
        return items.reduce((sum, item) => sum + (rows.get(item.hcpcs) ?? 0) * item.qty, 0);
      };
      const alternatives = [...pricesByVendor].flatMap(([vendorId, rows]) => {
        if (vendorId === order.vendor_id) return [];
        const monthlyPriceCents = totalFor(rows);
        if (monthlyPriceCents === null) return [];
        return [{ vendorName: vendorNames.get(vendorId) ?? "Another vendor", monthlyPriceCents }];
      }).sort((a, b) => a.monthlyPriceCents - b.monthlyPriceCents);

      return {
        orderId: order.id,
        orderNo: order.order_no,
        patientName: patientNames.get(order.patient_id) ?? "Patient name unavailable",
        items,
        vendorName: order.vendor_id ? (vendorNames.get(order.vendor_id) ?? "Vendor unavailable") : "Vendor not selected",
        monthlyPriceCents: order.price_cents
          ?? (order.vendor_id ? totalFor(pricesByVendor.get(order.vendor_id)) : null),
        thresholdCents: threshold,
        alternative: alternatives[0] ?? null,
      };
    });
    return { ok: true, cards };
  } catch {
    return { ok: false, reason: "error" };
  }
}
