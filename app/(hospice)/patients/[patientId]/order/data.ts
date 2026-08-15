import "server-only";

import { conditionScore, reliabilityScore, type DerivableEvent } from "@/src/lib/derive";
import { now } from "@/src/lib/clock";
import { loadSettings } from "../../../settings/data";
import type { Database } from "@/src/types/db";
import type { Loaded, OrderFlowData, VendorOption } from "./draft";

type Tables = Database["public"]["Tables"];

export async function loadOrderFlow(patientId: string): Promise<Loaded<OrderFlowData>> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false };
  }
  try {
    const { supabase } = await import("@/src/lib/supabase");
    const [patient, catalog, vendors, prices, settings, virtualNow] = await Promise.all([
      supabase.from("patients").select("first_name,last_name").eq("id", patientId).maybeSingle(),
      supabase.from("equipment_catalog").select("*"),
      supabase.from("vendors").select("id,name,open_weekends,status").eq("status", "active"),
      supabase.from("vendor_prices").select("*"),
      loadSettings(),
      now(),
    ]);

    if (patient.error || !patient.data) return { ok: false, missing: true };
    if (catalog.error || vendors.error || prices.error) return { ok: false };

    const vendorRows = vendors.data ?? [];
    const orders = await supabase.from("orders").select("id,vendor_id");
    if (orders.error) return { ok: false };
    const orderRows = orders.data ?? [];

    let events: Tables["order_events"]["Row"][] = [];
    if (orderRows.length > 0) {
      const res = await supabase.from("order_events").select("*")
        .in("order_id", orderRows.map((o) => o.id))
        .order("created_at", { ascending: true });
      if (res.error) return { ok: false };
      events = res.data ?? [];
    }
    const byOrder = new Map<string, DerivableEvent[]>();
    for (const event of events) {
      const list = byOrder.get(event.order_id);
      if (list) list.push(event);
      else byOrder.set(event.order_id, [event]);
    }

    const scored: VendorOption[] = vendorRows.map((vendor) => {
      const mine = orderRows.filter((o) => o.vendor_id === vendor.id);
      const vendorEvents = mine.flatMap((o) => byOrder.get(o.id) ?? []);
      const reliability = reliabilityScore(vendorEvents, { now: virtualNow });
      const condition = conditionScore(vendorEvents, { now: virtualNow });
      return {
        id: vendor.id,
        name: vendor.name,
        openWeekends: vendor.open_weekends,
        reliability: reliability.score ?? "unrated",
        condition: condition.score ?? "unrated",
      };
    });

    return {
      ok: true,
      data: {
        patientName: `${patient.data.first_name} ${patient.data.last_name}`,
        catalog: catalog.data ?? [],
        vendors: scored,
        prices: prices.data ?? [],
        thresholdCents: settings.values.don_threshold_cents,
        leadTimeHours: settings.values.lead_time_hours,
        nowIso: virtualNow.toISOString(),
      },
    };
  } catch {
    return { ok: false };
  }
}
