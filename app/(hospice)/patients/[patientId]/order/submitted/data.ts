import "server-only";

import type { Database } from "@/src/types/db";

type Tables = Database["public"]["Tables"];

export type Submission = {
  firstOrderId: string;
  orderNo: string;
  orderCount: number;
  vendorName: string;
  /** Monthly rental total across every order in this submission. */
  priceCents: number;
  cheapestVendorName: string;
  cheapestPriceCents: number;
};

export type SubmissionLoaded = { ok: true; data: Submission | null } | { ok: false };

function itemLines(items: Tables["orders"]["Row"]["items"]): { hcpcs: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.hcpcs !== "string") return [];
    return [{ hcpcs: item.hcpcs, qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1 }];
  });
}

/** Same comparison the nurse saw one screen earlier: cheapest vendor carrying every item. */
export async function loadSubmission(orderIds: string[]): Promise<SubmissionLoaded> {
  if (orderIds.length === 0) return { ok: true, data: null };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false };

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const orders = await supabase
      .from("orders")
      .select("id,order_no,vendor_id,price_cents,items")
      .in("id", orderIds)
      .order("order_no", { ascending: true });
    if (orders.error) return { ok: false };
    const rows = orders.data ?? [];
    if (rows.length === 0) return { ok: true, data: null };

    const priceCents = rows.reduce((sum, row) => sum + (row.price_cents ?? 0), 0);
    const lines = rows.flatMap((row) => itemLines(row.items));

    const [vendor, prices, vendors] = await Promise.all([
      rows[0].vendor_id
        ? supabase.from("vendors").select("name").eq("id", rows[0].vendor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("vendor_prices").select("vendor_id,hcpcs,price_cents")
        .in("hcpcs", lines.map((line) => line.hcpcs)),
      supabase.from("vendors").select("id,name").eq("status", "active"),
    ]);
    if (prices.error || vendors.error) return { ok: false };

    let cheapestVendorName = vendor?.data?.name ?? "this vendor";
    let cheapestPriceCents = priceCents;
    for (const candidate of vendors.data ?? []) {
      let total = 0;
      let carriesAll = true;
      for (const line of lines) {
        const price = (prices.data ?? []).find(
          (row) => row.vendor_id === candidate.id && row.hcpcs === line.hcpcs,
        );
        if (!price) {
          carriesAll = false;
          break;
        }
        total += price.price_cents * line.qty;
      }
      if (carriesAll && total < cheapestPriceCents) {
        cheapestPriceCents = total;
        cheapestVendorName = candidate.name;
      }
    }

    return {
      ok: true,
      data: {
        firstOrderId: rows[0].id,
        orderNo: rows[0].order_no,
        orderCount: rows.length,
        vendorName: vendor?.data?.name ?? "the vendor",
        priceCents,
        cheapestVendorName,
        cheapestPriceCents,
      },
    };
  } catch {
    return { ok: false };
  }
}
