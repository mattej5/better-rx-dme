import "server-only";
import {
  conditionScore,
  reliabilityScore,
  type DerivableEvent,
} from "@/src/lib/derive";
import { hasSupabaseEnv, type OrderEventRow } from "../../patients/data";
import { loadSettings, type LoadedSettings } from "../../settings/data";
import {
  FIXTURE_CATALOG,
  FIXTURE_PATIENTS,
  FIXTURE_VENDORS,
  fixturePrice,
  fixtureVendorEvents,
} from "../fixtures";
import { isCategory, type OrderContextData, type VendorOption, type VendorPrice } from "./types";

export * from "./types";

async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

/**
 * STUB pending SUPABASE_SERVICE_ROLE_KEY — app/(hospice)/order/fixtures.ts.
 * Reliability and condition still come out of derive.ts, run over synthetic event
 * logs. No score on this screen is written by hand.
 */
function fixtureContext(
  patientId: string,
  now: Date,
  settings: LoadedSettings,
): OrderContextData {
  const patient = FIXTURE_PATIENTS.find((p) => p.id === patientId) ?? FIXTURE_PATIENTS[0];

  const vendors: VendorOption[] = FIXTURE_VENDORS.map((v) => {
    const events = fixtureVendorEvents(v, now);
    const prices: Record<string, VendorPrice> = {};
    for (const item of FIXTURE_CATALOG) {
      const price = fixturePrice(v, item.hcpcs);
      if (price) {
        prices[item.hcpcs] = {
          monthlyCents: price.price_cents,
          inStock: price.in_stock,
          leadTimeHours: price.lead_time_hours,
        };
      }
    }
    return {
      id: v.id,
      name: v.name,
      openWeekends: v.open_weekends,
      hazmatCertified: v.hazmat_certified,
      dispatchPhone: v.dispatch_phone,
      prices,
      reliability: reliabilityScore(events, { now }),
      condition: conditionScore(events, { now }),
    };
  });

  return {
    source: "fixture",
    patient: {
      id: patient.id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      medRecNo: patient.med_rec_no,
    },
    catalog: FIXTURE_CATALOG.flatMap((c) =>
      isCategory(c.category)
        ? [{
            hcpcs: c.hcpcs,
            plainName: c.plain_name,
            category: c.category,
            hazmat: c.hazmat,
            timeCritical: c.time_critical,
            imageUrl: c.image_url,
          }]
        : [],
    ),
    vendors,
    donThresholdCents: settings.values.don_threshold_cents,
    donThresholdFromSettings: settings.persisted.has("don_threshold_cents"),
    leadTimeHours: settings.values.lead_time_hours,
  };
}

export async function loadOrderContext(
  patientId: string,
  now: Date,
): Promise<OrderContextData> {
  const settings = await loadSettings();

  if (!hasSupabaseEnv()) return fixtureContext(patientId, now, settings);

  try {
    const db = await client();
    const [patientRes, catalogRes, vendorsRes, pricesRes, ordersRes] = await Promise.all([
      db
        .from("patients")
        .select("id,first_name,last_name,med_rec_no")
        .eq("id", patientId)
        .maybeSingle(),
      db.from("equipment_catalog").select("*").order("plain_name", { ascending: true }),
      db.from("vendors").select("*").neq("status", "paused").order("name", { ascending: true }),
      db.from("vendor_prices").select("*"),
      db.from("orders").select("id,vendor_id"),
    ]);

    if (catalogRes.error || vendorsRes.error || pricesRes.error || ordersRes.error) {
      return fixtureContext(patientId, now, settings);
    }

    const orderRows = ordersRes.data ?? [];
    let events: OrderEventRow[] = [];
    if (orderRows.length > 0) {
      const res = await db
        .from("order_events")
        .select("*")
        .in("order_id", orderRows.map((o) => o.id))
        .order("created_at", { ascending: true });
      if (res.error) return fixtureContext(patientId, now, settings);
      events = res.data ?? [];
    }

    const eventsByOrderId = new Map<string, DerivableEvent[]>();
    for (const e of events) {
      const list = eventsByOrderId.get(e.order_id);
      if (list) list.push(e);
      else eventsByOrderId.set(e.order_id, [e]);
    }

    const pricesByVendor = new Map<string, Record<string, VendorPrice>>();
    for (const p of pricesRes.data ?? []) {
      const bucket = pricesByVendor.get(p.vendor_id) ?? {};
      bucket[p.hcpcs] = {
        monthlyCents: p.price_cents,
        inStock: p.in_stock,
        leadTimeHours: p.lead_time_hours,
      };
      pricesByVendor.set(p.vendor_id, bucket);
    }

    const vendors: VendorOption[] = (vendorsRes.data ?? []).map((v) => {
      const vendorEvents = orderRows
        .filter((o) => o.vendor_id === v.id)
        .flatMap((o) => eventsByOrderId.get(o.id) ?? []);
      return {
        id: v.id,
        name: v.name,
        openWeekends: v.open_weekends,
        hazmatCertified: v.hazmat_certified,
        dispatchPhone: v.dispatch_phone,
        prices: pricesByVendor.get(v.id) ?? {},
        reliability: reliabilityScore(vendorEvents, { now }),
        condition: conditionScore(vendorEvents, { now }),
      };
    });

    return {
      source: "database",
      patient: patientRes.data
        ? {
            id: patientRes.data.id,
            firstName: patientRes.data.first_name,
            lastName: patientRes.data.last_name,
            medRecNo: patientRes.data.med_rec_no,
          }
        : null,
      catalog: (catalogRes.data ?? []).flatMap((c) =>
        isCategory(c.category)
          ? [{
              hcpcs: c.hcpcs,
              plainName: c.plain_name,
              category: c.category,
              hazmat: c.hazmat,
              timeCritical: c.time_critical,
              imageUrl: c.image_url,
            }]
          : [],
      ),
      vendors,
      donThresholdCents: settings.values.don_threshold_cents,
      donThresholdFromSettings: settings.persisted.has("don_threshold_cents"),
      leadTimeHours: settings.values.lead_time_hours,
    };
  } catch {
    return fixtureContext(patientId, now, settings);
  }
}
