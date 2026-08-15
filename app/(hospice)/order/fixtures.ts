// STUB pending SUPABASE_SERVICE_ROLE_KEY.
//
// There is no .env.local in this checkout, so `hasSupabaseEnv()` is false and every
// loader in the N8/N9/N10 lane falls back to the data below. It mirrors scripts/seed.mjs
// (same vendors, same price factors, same catalog, same demo order numbers) so that
// deleting this file — and the two `if (!hasSupabaseEnv())` branches that import it —
// is the whole swap once the service-role key lands.
//
// Scores are NOT hardcoded here. The fixture ships synthetic EVENT LOGS and derive.ts
// computes reliability/condition from them, exactly as the database path does. That is
// deliberate: a hand-written "94%" would be a fake result.

import type { DerivableEvent } from "@/src/lib/derive";

export type FixtureCatalogItem = {
  hcpcs: string;
  plain_name: string;
  category: string;
  serialized: boolean;
  hazmat: boolean;
  time_critical: boolean;
  image_url: string | null;
};

/** wiki/facts/dme-catalog.md, same 26 codes scripts/seed.mjs writes. */
export const FIXTURE_CATALOG: FixtureCatalogItem[] = (
  [
    ["E0260", "Hospital bed (semi-electric)", "bed", 0, 0],
    ["E0250", "Hospital bed (fixed height)", "bed", 0, 0],
    ["E0184", "Pressure-relief mattress (foam overlay)", "bed", 0, 0],
    ["E0277", "Alternating-pressure / low-air-loss mattress", "bed", 0, 0],
    ["E0310", "Bed rails", "bed", 0, 0],
    ["E0910", "Trapeze bar", "bed", 0, 0],
    ["E0274", "Overbed table", "bed", 0, 0],
    ["E1390", "Oxygen concentrator", "respiratory", 0, 1],
    ["E0431", "Portable oxygen (gas cylinder)", "respiratory", 1, 1],
    ["E0601", "CPAP", "respiratory", 0, 1],
    ["E0470", "BiPAP / RAD", "respiratory", 0, 1],
    ["E0570", "Nebulizer", "respiratory", 0, 0],
    ["E0600", "Suction machine", "respiratory", 0, 1],
    ["E1130", "Standard wheelchair", "mobility", 0, 0],
    ["E1038", "Transport chair", "mobility", 0, 0],
    ["E2601", "Wheelchair cushion", "mobility", 0, 0],
    ["E0143", "Folding wheeled walker", "mobility", 0, 0],
    ["E0100", "Cane", "mobility", 0, 0],
    ["E0630", "Patient lift (Hoyer) + sling", "transfer", 0, 0],
    ["E0163", "Bedside commode", "transfer", 0, 0],
    ["E0240", "Shower / bath chair", "transfer", 0, 0],
    ["A4615", "Oxygen tubing and cannula kit", "consumable", 0, 0],
    ["A6216", "Wound dressing supplies", "consumable", 0, 0],
    ["T4527", "Incontinence briefs and underpads", "consumable", 0, 0],
    ["A4353", "Foley catheter kit and drainage bag", "consumable", 0, 0],
    ["A4406", "Ostomy supplies", "consumable", 0, 0],
  ] as const
).map(([hcpcs, plain_name, category, hazmat, time_critical]) => ({
  hcpcs,
  plain_name,
  category,
  serialized: category !== "consumable",
  hazmat: hazmat === 1,
  time_critical: time_critical === 1,
  image_url: null,
}));

/** Monthly rental cents, before the per-vendor factor. Same table as the seed. */
const BASE_PRICE_CENTS: Record<string, number> = {
  E0260: 25000, E0250: 20500, E0184: 7000, E0277: 39000, E0310: 3500,
  E0910: 5200, E0274: 2800, E1390: 16500, E0431: 14500, E0601: 8900,
  E0470: 24000, E0570: 4800, E0600: 11500, E1130: 7200, E1038: 6500,
  E2601: 2600, E0143: 3200, E0100: 1500, E0630: 20500, E0163: 2900,
  E0240: 2400, A4615: 1800, A6216: 7600, T4527: 6800, A4353: 4200, A4406: 5900,
};

const CATEGORY_LEAD_HOURS: Record<string, number> = {
  bed: 24, respiratory: 12, mobility: 24, transfer: 30, consumable: 18,
};

export type FixtureVendor = {
  id: string;
  name: string;
  categories: string[];
  open_weekends: boolean;
  hazmat_certified: boolean;
  dispatch_phone: string;
  /** Price multiplier against BASE_PRICE_CENTS. */
  factor: number;
  /** Hours added to the category lead time. */
  lead_offset: number;
  /** How many completed synthetic orders back this vendor's score. <5 renders Unrated. */
  history: number;
  confirm_mins: number;
  /** Every Nth synthetic order lands late. 0 = never. */
  late_every: number;
  late_minutes: number;
  pickup_hours: number;
  /** Every Nth synthetic order arrives dirty or damaged. 0 = never. */
  issue_every: number;
};

export const FIXTURE_VENDORS: FixtureVendor[] = [
  {
    id: "fx-vendor-ridgeline", name: "Ridgeline Medical Supply",
    categories: ["bed", "respiratory", "mobility", "transfer", "consumable"],
    open_weekends: true, hazmat_certified: true, dispatch_phone: "+13035550101",
    factor: 1, lead_offset: 0, history: 14, confirm_mins: 9,
    late_every: 9, late_minutes: 75, pickup_hours: 14, issue_every: 0,
  },
  {
    id: "fx-vendor-gulfcoast", name: "Gulf Coast Home Medical",
    categories: ["bed", "respiratory", "mobility", "transfer"],
    open_weekends: true, hazmat_certified: true, dispatch_phone: "+13035550102",
    factor: 1.2, lead_offset: -4, history: 12, confirm_mins: 38,
    late_every: 3, late_minutes: 95, pickup_hours: 20, issue_every: 7,
  },
  {
    id: "fx-vendor-valuecare", name: "ValueCare DME",
    categories: ["bed", "respiratory", "mobility", "transfer", "consumable"],
    open_weekends: false, hazmat_certified: false, dispatch_phone: "+13035550103",
    factor: 0.76, lead_offset: 14, history: 13, confirm_mins: 95,
    late_every: 2, late_minutes: 260, pickup_hours: 78, issue_every: 3,
  },
  {
    id: "fx-vendor-beacon", name: "Beacon Respiratory",
    categories: ["respiratory", "consumable"],
    open_weekends: true, hazmat_certified: true, dispatch_phone: "+13035550104",
    factor: 1.08, lead_offset: -6, history: 11, confirm_mins: 12,
    late_every: 11, late_minutes: 40, pickup_hours: 16, issue_every: 0,
  },
  {
    id: "fx-vendor-crosscounty", name: "Cross County Mobility",
    categories: ["mobility", "transfer"],
    open_weekends: false, hazmat_certified: false, dispatch_phone: "+13035550105",
    factor: 0.9, lead_offset: 4, history: 9, confirm_mins: 26,
    late_every: 5, late_minutes: 55, pickup_hours: 22, issue_every: 6,
  },
  {
    // Brand-new vendor: 3 orders is under MIN_ORDERS_FOR_SCORE, so derive.ts
    // returns Unrated. The compare screen renders that state rather than a zero.
    id: "fx-vendor-northstar", name: "NorthStar Home Equipment",
    categories: ["bed", "respiratory", "mobility", "transfer", "consumable"],
    open_weekends: true, hazmat_certified: true, dispatch_phone: "+13035550106",
    factor: 1.03, lead_offset: 2, history: 3, confirm_mins: 15,
    late_every: 0, late_minutes: 0, pickup_hours: 18, issue_every: 0,
  },
];

const CATEGORY_BY_CODE = new Map(FIXTURE_CATALOG.map((c) => [c.hcpcs, c]));

export function fixturePrice(
  vendor: FixtureVendor,
  hcpcs: string,
): { price_cents: number; in_stock: boolean; lead_time_hours: number } | null {
  const item = CATEGORY_BY_CODE.get(hcpcs);
  if (!item || !vendor.categories.includes(item.category)) return null;
  const base = BASE_PRICE_CENTS[hcpcs];
  if (base === undefined) return null;
  const index = FIXTURE_CATALOG.findIndex((c) => c.hcpcs === hcpcs);
  return {
    price_cents: Math.round((base * vendor.factor) / 50) * 50,
    in_stock: !(vendor.id === "fx-vendor-valuecare" && index % 11 === 0),
    lead_time_hours: Math.max(
      2,
      CATEGORY_LEAD_HOURS[item.category] + vendor.lead_offset + ((index % 3) * 2),
    ),
  };
}

function plus(base: Date, { d = 0, h = 0, m = 0 }): Date {
  return new Date(base.getTime() + ((d * 24 + h) * 60 + m) * 60_000);
}

const iso = (d: Date) => d.toISOString();

/**
 * Synthetic completed orders for one vendor, as an event log. Fed straight into
 * reliabilityScore()/conditionScore() — no score is written by hand.
 */
export function fixtureVendorEvents(vendor: FixtureVendor, now: Date): DerivableEvent[] {
  const events: DerivableEvent[] = [];
  const pool = FIXTURE_CATALOG.filter((c) => vendor.categories.includes(c.category));

  for (let i = 0; i < vendor.history; i += 1) {
    const order_id = `${vendor.id}-h${i}`;
    const code = pool[(i * 3) % pool.length].hcpcs;
    const placed = plus(now, { d: -(4 + i * 3), h: -(2 + (i % 6)) });
    const notified = plus(placed, { m: 4 });
    const confirmed = plus(notified, { m: vendor.confirm_mins + (i % 4) * 6 });
    const target = plus(confirmed, { h: 18 });
    const late = vendor.late_every > 0 && i % vendor.late_every === 0;
    const delivered = plus(target, { m: late ? vendor.late_minutes : -40 });
    const dispatched = plus(delivered, { h: -3 });

    const push = (
      type: string,
      when: Date,
      payload: Record<string, unknown> = {},
    ) => events.push({ type, created_at: iso(when), order_id, payload });

    push("order_placed", placed, {
      items: [{ hcpcs: code, qty: 1 }],
      urgency: "routine",
      target_at: iso(target),
    });
    push("vendor_notified", notified, { vendor_id: vendor.id, channel: "sms", nudge: false });
    push("vendor_confirmed", confirmed, { vendor_id: vendor.id, promised_eta: iso(target) });
    push("dispatched", dispatched, { route: `Synthetic route ${1 + (i % 5)}` });
    push("eta_updated", plus(dispatched, { m: 30 }), { eta: iso(target), source: "vendor" });
    if (late) {
      push("at_risk_flagged", plus(delivered, { h: -1 }), {
        rule: "eta_misses_deadline",
        reason: "Synthetic history: projected arrival past the promised window.",
      });
    }
    push("delivered", delivered, { signature_name: "Synthetic recipient" });

    const issue =
      vendor.issue_every > 0 && i % vendor.issue_every === 0
        ? (i % 2 === 0 ? "dirty" : "damaged")
        : "none";
    push("condition_reported", plus(delivered, { m: 10 }), {
      phase: "delivery",
      functional: issue !== "damaged",
      clean: issue !== "dirty",
      repair: issue === "damaged" ? "poor" : issue === "dirty" ? "worn" : "good",
      issue,
    });

    if (i % 4 === 0) {
      const requested = plus(delivered, { d: 4 });
      const pickedUp = plus(requested, { h: vendor.pickup_hours });
      push("pickup_requested", requested, { notified_vendor_ids: [vendor.id] });
      push("pickup_scheduled", plus(requested, { m: 40 }), {
        window_start: iso(plus(pickedUp, { h: -2 })),
        window_end: iso(pickedUp),
        batched: vendor.pickup_hours <= 24,
      });
      push("picked_up", pickedUp, {});
    }
  }

  return events;
}

export type FixturePatient = {
  id: string;
  external_id: string;
  med_rec_no: string;
  first_name: string;
  last_name: string;
  city: string;
  emr_source: string;
  care_status: string;
};

export const FIXTURE_PATIENTS: FixturePatient[] = [
  { id: "fx-pt-88421", external_id: "PT-88421", med_rec_no: "MRN-61000", first_name: "Evelyn", last_name: "Brooks", city: "Aurora", emr_source: "HCHB", care_status: "active" },
  { id: "fx-pt-88190", external_id: "PT-88190", med_rec_no: "MRN-61001", first_name: "Walter", last_name: "Kim", city: "Aurora", emr_source: "HCHB", care_status: "active" },
  { id: "fx-pt-88502", external_id: "PT-88502", med_rec_no: "MRN-61002", first_name: "Maria", last_name: "Santos", city: "Aurora", emr_source: "HCHB", care_status: "active" },
  { id: "fx-pt-87411", external_id: "PT-87411", med_rec_no: "MRN-61005", first_name: "James", last_name: "Wilson", city: "Aurora", emr_source: "HCHB", care_status: "deceased" },
];

export type FixtureMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  who: string;
  created_at: string;
  /** Left null on purpose for the messy reply, so the screen parses it live. */
  parsed: { intent: string; confidence: number; parser: string } | null;
};

export type FixtureOrderRecord = {
  id: string;
  order_no: string;
  patient_id: string;
  vendor_id: string | null;
  status: string;
  urgency: "admission" | "routine" | "stat";
  items: { hcpcs: string; plain_name: string; qty: number }[];
  price_cents: number | null;
  ordered_at: string;
  target_at: string | null;
  pickup_requested_at: string | null;
  events: DerivableEvent[];
  messages: FixtureMessage[];
};

function fixtureItem(hcpcs: string, qty = 1) {
  const found = CATEGORY_BY_CODE.get(hcpcs);
  return { hcpcs, plain_name: found?.plain_name ?? hcpcs, qty };
}

/**
 * Three demo orders, same order numbers scripts/seed.mjs writes:
 *   DME-10305 — STAT suction machine, just went at risk (the "amber" screen)
 *   DME-10198 — admission oxygen concentrator, in transit, messy free-text reply
 *   DME-09803 — hospital bed, pickup requested 4 days ago and still sitting
 */
export function fixtureOrders(now: Date): FixtureOrderRecord[] {
  const gulf = FIXTURE_VENDORS[1];
  const ridge = FIXTURE_VENDORS[0];
  const value = FIXTURE_VENDORS[2];

  const ev = (
    order_id: string,
    type: string,
    when: Date,
    payload: Record<string, unknown> = {},
    actor?: string,
    actor_role?: string,
  ): DerivableEvent & { actor?: string; actor_role?: string } => ({
    type, created_at: iso(when), order_id, payload, actor, actor_role,
  });

  // --- DME-10305: STAT suction machine, flagged four minutes ago -------------
  const a = { id: "fx-order-10305", no: "DME-10305" };
  const aPlaced = plus(now, { h: -3, m: -10 });
  const aTarget = plus(now, { h: 1, m: 20 });
  const aEta = plus(now, { h: 2, m: 5 });
  const aFlagged = plus(now, { m: -4 });
  const orderA: FixtureOrderRecord = {
    id: a.id, order_no: a.no, patient_id: "fx-pt-88502", vendor_id: gulf.id,
    status: "dispatched", urgency: "stat",
    items: [fixtureItem("E0600")],
    price_cents: fixturePrice(gulf, "E0600")?.price_cents ?? null,
    ordered_at: iso(aPlaced), target_at: iso(aTarget), pickup_requested_at: null,
    events: [
      ev(a.id, "order_placed", aPlaced, { items: [fixtureItem("E0600")], urgency: "stat", target_at: iso(aTarget), vendor_id: gulf.id }, "David L.", "case_manager"),
      ev(a.id, "vendor_notified", plus(aPlaced, { m: 2 }), { vendor_id: gulf.id, channel: "sms", nudge: false }, "System", "system"),
      ev(a.id, "message_sent", plus(aPlaced, { m: 2 }), { vendor_id: gulf.id, kind: "notify", message_id: "fx-msg-10305-1" }, "System", "system"),
      ev(a.id, "vendor_confirmed", plus(aPlaced, { m: 21 }), { vendor_id: gulf.id, promised_eta: iso(plus(now, { h: 0, m: 40 })) }, "Gulf Coast dispatch", "vendor"),
      ev(a.id, "dispatched", plus(now, { h: -1, m: -5 }), { route: "Route 5" }, "Gulf Coast dispatch", "vendor"),
      ev(a.id, "message_received", plus(now, { m: -6 }), { vendor_id: gulf.id, message_id: "fx-msg-10305-2" }, "Gulf Coast dispatch", "vendor"),
      ev(a.id, "eta_updated", plus(now, { m: -5 }), { eta: iso(aEta), source: "vendor" }, "Gulf Coast dispatch", "vendor"),
      ev(a.id, "at_risk_flagged", aFlagged, {
        rule: "eta_misses_deadline",
        severity: "red",
        reason: `Delivery ETA ${hhmm(aEta)}, needed by ${hhmm(aTarget)}, misses by 45 minutes.`,
      }, "Rules engine", "system"),
    ],
    messages: [
      { id: "fx-msg-10305-1", direction: "outbound", body: `New STAT order from Desert Valley Hospice. 1 suction machine for a patient in Aurora. Needed before ${hhmm(aTarget)} today. Tap to confirm, or just reply with a time.`, who: "To Gulf Coast dispatch", created_at: iso(plus(aPlaced, { m: 2 })), parsed: null },
      // parsed left null so the order page runs parseWithRegex() live on this text.
      { id: "fx-msg-10305-2", direction: "inbound", body: "stuck behind an accident on I-15, maybe 2hrs", who: "Gulf Coast dispatch", created_at: iso(plus(now, { m: -6 })), parsed: null },
    ],
  };

  // --- DME-10198: admission oxygen concentrator, healthy -------------------
  const b = { id: "fx-order-10198", no: "DME-10198" };
  const bPlaced = plus(now, { h: -26 });
  const bTarget = plus(now, { h: 8 });
  const orderB: FixtureOrderRecord = {
    id: b.id, order_no: b.no, patient_id: "fx-pt-88190", vendor_id: ridge.id,
    status: "in_transit", urgency: "admission",
    items: [fixtureItem("E1390")],
    price_cents: fixturePrice(ridge, "E1390")?.price_cents ?? null,
    ordered_at: iso(bPlaced), target_at: iso(bTarget), pickup_requested_at: null,
    events: [
      ev(b.id, "order_placed", bPlaced, { items: [fixtureItem("E1390")], urgency: "admission", target_at: iso(bTarget), vendor_id: ridge.id }, "Maria R.", "nurse"),
      ev(b.id, "vendor_notified", plus(bPlaced, { m: 8 }), { vendor_id: ridge.id, channel: "sms", nudge: false }, "System", "system"),
      ev(b.id, "vendor_confirmed", plus(bPlaced, { m: 19 }), { vendor_id: ridge.id, promised_eta: iso(plus(now, { h: 4 })) }, "Ridgeline dispatch", "vendor"),
      ev(b.id, "dispatched", plus(now, { h: -4 }), { route: "Route 4" }, "Ridgeline dispatch", "vendor"),
      ev(b.id, "eta_updated", plus(now, { h: -3, m: -40 }), { eta: iso(plus(now, { h: 4 })), source: "vendor" }, "Ridgeline dispatch", "vendor"),
    ],
    messages: [],
  };

  // --- DME-09803: pickup requested four days ago, family has called twice ----
  const c = { id: "fx-order-09803", no: "DME-09803" };
  const cPlaced = plus(now, { d: -28 });
  const cDelivered = plus(now, { d: -26 });
  const cDeath = plus(now, { d: -4 });
  const orderC: FixtureOrderRecord = {
    id: c.id, order_no: c.no, patient_id: "fx-pt-87411", vendor_id: value.id,
    status: "pickup_triggered", urgency: "routine",
    items: [fixtureItem("E0260")],
    price_cents: fixturePrice(value, "E0260")?.price_cents ?? null,
    ordered_at: iso(cPlaced), target_at: iso(plus(now, { d: -27 })),
    pickup_requested_at: iso(plus(cDeath, { m: 2 })),
    events: [
      ev(c.id, "order_placed", cPlaced, { items: [fixtureItem("E0260")], urgency: "routine", target_at: iso(plus(now, { d: -27 })), vendor_id: value.id }, "David L.", "case_manager"),
      ev(c.id, "vendor_notified", plus(cPlaced, { m: 7 }), { vendor_id: value.id, channel: "sms", nudge: false }, "System", "system"),
      ev(c.id, "vendor_confirmed", plus(cPlaced, { h: 2 }), { vendor_id: value.id, promised_eta: iso(plus(now, { d: -27 })) }, "ValueCare dispatch", "vendor"),
      ev(c.id, "delivered", cDelivered, { signature_name: "Family caregiver" }, "ValueCare driver", "vendor"),
      ev(c.id, "patient_status_changed", cDeath, { to: "deceased", status: "deceased" }, "Maria R.", "nurse"),
      ev(c.id, "pickup_requested", plus(cDeath, { m: 2 }), { notified_vendor_ids: [value.id] }, "David L.", "case_manager"),
      ev(c.id, "message_received", plus(now, { d: -2 }), { from: "family", message_id: "fx-msg-09803-1" }, "Family caregiver", "system"),
      ev(c.id, "message_received", plus(now, { h: -18 }), { from: "family", message_id: "fx-msg-09803-2" }, "Family caregiver", "system"),
      ev(c.id, "at_risk_flagged", plus(now, { h: -20 }), {
        rule: "pickup_delayed",
        severity: "red",
        reason: "Bed reported ready 4 days ago. No pickup scheduled. Family has called twice.",
      }, "Rules engine", "system"),
    ],
    messages: [
      { id: "fx-msg-09803-1", direction: "inbound", body: "Family called: equipment is still at the home. When is pickup?", who: "Family caregiver", created_at: iso(plus(now, { d: -2 })), parsed: { intent: "question", confidence: 1, parser: "deterministic" } },
      { id: "fx-msg-09803-2", direction: "inbound", body: "Second family call: bed still has not been collected.", who: "Family caregiver", created_at: iso(plus(now, { h: -18 })), parsed: { intent: "question", confidence: 1, parser: "deterministic" } },
    ],
  };

  return [orderA, orderB, orderC];
}

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Denver",
  }).format(d);
}
