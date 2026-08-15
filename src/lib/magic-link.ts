// N6/N12 — vendor magic-link tokens: issue, resolve, and the reads the four
// /v/[token] pages need. Zero login: the token row IS the vendor's identity.
// Contracts amendment 6/11 pins the column as `scope` with four canonical values.
// Issuing a link emits NO event (not in the pinned EventType union) — it is a
// magic_links row plus a line in the message_sent payload written by sendMessage().
import "server-only";

import { conditionScore, deriveBadges, reliabilityScore } from "@/src/lib/derive";
import type { DerivableEvent, ScoreResult } from "@/src/lib/derive";
import type { Badge, StopVariant } from "@/src/lib/domain";
import type { Database, Json } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
export type VendorRow = Tables["vendors"]["Row"];
export type OrderRow = Tables["orders"]["Row"];
export type OrderEventRow = Tables["order_events"]["Row"];
export type EquipmentRow = Tables["equipment_catalog"]["Row"];

export const MAGIC_LINK_SCOPES = [
  "run_list",
  "onboarding",
  "report_card",
  "stop",
] as const;

export type MagicLinkScope = (typeof MAGIC_LINK_SCOPES)[number];

export function isMagicLinkScope(value: unknown): value is MagicLinkScope {
  return (
    typeof value === "string" &&
    (MAGIC_LINK_SCOPES as readonly string[]).includes(value)
  );
}

/** [assumed] — no sponsor number exists. Long enough to survive a shift handoff. */
export const MAGIC_LINK_TTL_HOURS = 72;

/** engine.md §1.2 pins nanoid(24). Same 64-char alphabet, no runtime dependency. */
const ALPHABET =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
export const TOKEN_LENGTH = 24;

export function newToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte & 63];
  return out;
}

export function routeForScope(
  scope: MagicLinkScope,
  token: string,
  orderId?: string | null,
): string {
  if (scope === "onboarding") return `/v/${token}/welcome`;
  if (scope === "report_card") return `/v/${token}/scorecard`;
  if (scope === "stop" && orderId) return `/v/${token}/stop/${orderId}`;
  return `/v/${token}`;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * supabase.ts asserts both env vars at module scope, so importing it without a
 * service-role key throws at import time. Import lazily, after the env check.
 */
async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export type IssueInput = {
  vendorId: string;
  scope: MagicLinkScope;
  orderId?: string | null;
  ttlHours?: number;
};

export type IssuedLink = { token: string; path: string; expiresAt: string };

export async function issueMagicLink(
  input: IssueInput,
  issuedAt: Date,
): Promise<IssuedLink> {
  const db = await client();
  const ttl = input.ttlHours ?? MAGIC_LINK_TTL_HOURS;
  const token = newToken();
  const expiresAt = new Date(
    issuedAt.getTime() + ttl * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await db.from("magic_links").insert({
    token,
    vendor_id: input.vendorId,
    scope: input.scope,
    order_id: input.orderId ?? null,
    expires_at: expiresAt,
    created_at: issuedAt.toISOString(),
  });
  if (error) throw new Error(error.message);

  return { token, path: routeForScope(input.scope, token, input.orderId), expiresAt };
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

export type LinkSource = "db" | "fixture";

export type ResolvedLink = {
  token: string;
  scope: MagicLinkScope;
  orderId: string | null;
  expiresAt: string | null;
  vendor: VendorRow;
  source: LinkSource;
};

export type ResolveResult =
  | { status: "ok"; link: ResolvedLink }
  | { status: "expired" }
  | { status: "unknown" }
  | { status: "error" };

/** Single indexed lookup + expiry check. NOT single-use: forwarding is the feature. */
export async function resolveToken(
  token: string,
  now: Date,
): Promise<ResolveResult> {
  if (!hasSupabaseEnv()) return resolveFixtureToken(token, now);
  try {
    const db = await client();
    const { data, error } = await db
      .from("magic_links")
      .select("token, scope, order_id, expires_at, vendor_id, vendors(*)")
      .eq("token", token)
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data) return { status: "unknown" };
    if (data.expires_at && Date.parse(data.expires_at) <= now.getTime()) {
      return { status: "expired" };
    }
    // A to-one embed returns an object, but tolerate the array shape too rather
    // than hand a driver a blank page over a PostgREST relationship detail.
    const embedded: unknown = data.vendors;
    const vendor = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | VendorRow
      | undefined;
    if (!vendor || !isMagicLinkScope(data.scope)) return { status: "error" };
    return {
      status: "ok",
      link: {
        token: data.token,
        scope: data.scope,
        orderId: data.order_id,
        expiresAt: data.expires_at,
        vendor,
        source: "db",
      },
    };
  } catch {
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Run list (N6)
// ---------------------------------------------------------------------------

export type StopItem = { hcpcs: string; plainName: string; qty: number };

export type VendorStop = {
  orderId: string;
  orderNo: string;
  variant: StopVariant;
  hazmat: boolean;
  status: OrderRow["status"];
  badges: Badge[];
  patientLabel: string;
  hospiceName: string;
  address: string;
  addressNote: string | null;
  /** Sort key. Null sorts last — an unscheduled stop is not "first". */
  windowStart: string | null;
  windowEnd: string | null;
  windowKind: "eta" | "needed_by" | "pickup_window" | "pickup_requested" | "none";
  items: StopItem[];
  familyNote: string | null;
};

export type RunList = { stops: VendorStop[]; source: LinkSource };

const OPEN_STATUSES = [
  "ordered",
  "dispatched",
  "in_transit",
  "pickup_triggered",
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function formatAddress(address: unknown): string {
  const a = record(address);
  const street = text(a.street1);
  const city = text(a.city);
  const state = text(a.state);
  const zip = text(a.zip);
  const tail = [city, state].filter(Boolean).join(", ");
  return [street, [tail, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function stopItems(items: OrderRow["items"], catalog: Map<string, EquipmentRow>): StopItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const rec = record(raw);
    const hcpcs = text(rec.hcpcs);
    if (!hcpcs) return [];
    const qty = typeof rec.qty === "number" && rec.qty > 0 ? rec.qty : 1;
    return [
      {
        hcpcs,
        plainName: text(rec.plain_name) ?? catalog.get(hcpcs)?.plain_name ?? hcpcs,
        qty,
      },
    ];
  });
}

function lastEvent(events: DerivableEvent[], type: string): DerivableEvent | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) return events[i];
  }
  return undefined;
}

/**
 * Variant is read off the order, never guessed from the item name alone:
 *   pickup      — status pickup_triggered (pickup_requested with no picked_up)
 *   oxygen_swap — an open resupply schedule flagged is_swap covers one of the items
 *   delivery    — everything else
 */
function stopVariant(
  order: OrderRow,
  swapCodesByPatient: Map<string, Set<string>>,
  items: StopItem[],
): StopVariant {
  if (order.status === "pickup_triggered") return "pickup";
  const swaps = swapCodesByPatient.get(order.patient_id);
  if (swaps && items.some((i) => swaps.has(i.hcpcs))) return "oxygen_swap";
  return "delivery";
}

function stopWindow(
  order: OrderRow,
  events: DerivableEvent[],
): Pick<VendorStop, "windowStart" | "windowEnd" | "windowKind"> {
  if (order.status === "pickup_triggered") {
    const scheduled = lastEvent(events, "pickup_scheduled");
    const payload = record(scheduled?.payload);
    const start = text(payload.window_start) ?? order.pickup_scheduled_at;
    if (start) {
      return {
        windowStart: start,
        windowEnd: text(payload.window_end),
        windowKind: "pickup_window",
      };
    }
    return {
      windowStart: order.pickup_requested_at,
      windowEnd: null,
      windowKind: "pickup_requested",
    };
  }
  const eta = order.current_eta ?? order.promised_eta;
  if (eta) return { windowStart: eta, windowEnd: null, windowKind: "eta" };
  if (order.target_at) {
    return { windowStart: order.target_at, windowEnd: null, windowKind: "needed_by" };
  }
  return { windowStart: null, windowEnd: null, windowKind: "none" };
}

function sortStops(stops: VendorStop[]): VendorStop[] {
  return [...stops].sort((a, b) => {
    if (a.windowStart === null) return b.windowStart === null ? 0 : 1;
    if (b.windowStart === null) return -1;
    return Date.parse(a.windowStart) - Date.parse(b.windowStart);
  });
}

export async function loadRunList(
  link: ResolvedLink,
  now: Date,
): Promise<{ ok: true; data: RunList } | { ok: false }> {
  if (link.source === "fixture") {
    return { ok: true, data: { stops: sortStops(fixtureStops(now)), source: "fixture" } };
  }
  try {
    const db = await client();
    const orders = await db
      .from("orders")
      .select("*")
      .eq("vendor_id", link.vendor.id)
      .in("status", [...OPEN_STATUSES]);
    if (orders.error) return { ok: false };
    const orderRows = orders.data ?? [];
    if (orderRows.length === 0) {
      return { ok: true, data: { stops: [], source: "db" } };
    }

    const patientIds = [...new Set(orderRows.map((o) => o.patient_id))];
    const [eventsRes, patientsRes, catalogRes, swapRes] = await Promise.all([
      db
        .from("order_events")
        .select("*")
        .in("order_id", orderRows.map((o) => o.id))
        .order("created_at", { ascending: true }),
      db.from("patients").select("*").in("id", patientIds),
      db.from("equipment_catalog").select("*"),
      db
        .from("resupply_schedules")
        .select("patient_id, hcpcs")
        .in("patient_id", patientIds)
        .eq("is_swap", true)
        .eq("active", true),
    ]);
    if (eventsRes.error || patientsRes.error || catalogRes.error || swapRes.error) {
      return { ok: false };
    }

    const catalog = new Map((catalogRes.data ?? []).map((c) => [c.hcpcs, c]));
    const patients = new Map((patientsRes.data ?? []).map((p) => [p.id, p]));
    const byOrder = new Map<string, OrderEventRow[]>();
    for (const e of eventsRes.data ?? []) {
      const list = byOrder.get(e.order_id);
      if (list) list.push(e);
      else byOrder.set(e.order_id, [e]);
    }
    const swapCodes = new Map<string, Set<string>>();
    for (const s of swapRes.data ?? []) {
      const set = swapCodes.get(s.patient_id) ?? new Set<string>();
      set.add(s.hcpcs);
      swapCodes.set(s.patient_id, set);
    }

    const stops = orderRows.flatMap((order) => {
      const patient = patients.get(order.patient_id);
      if (!patient) return [];
      const events = byOrder.get(order.id) ?? [];
      const items = stopItems(order.items, catalog);
      return [
        {
          orderId: order.id,
          orderNo: order.order_no,
          variant: stopVariant(order, swapCodes, items),
          hazmat: items.some((i) => catalog.get(i.hcpcs)?.hazmat === true),
          status: order.status,
          badges: deriveBadges(events, { now }),
          patientLabel: `${patient.first_name} ${patient.last_name.slice(0, 1)}.`,
          hospiceName: patient.hospice_name,
          address: formatAddress(patient.address),
          addressNote: text(record(patient.address).note),
          items,
          familyNote: text(record(lastEvent(events, "pickup_requested")?.payload).family_note),
          ...stopWindow(order, events),
        } satisfies VendorStop,
      ];
    });

    return { ok: true, data: { stops: sortStops(stops), source: "db" } };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Report card (N12)
// ---------------------------------------------------------------------------

export type ProofEntry = {
  orderId: string;
  orderNo: string;
  kind: "delivered" | "picked_up";
  at: string;
  photoUrl: string | null;
  signature: string | null;
  patientLabel: string;
};

export type Scorecard = {
  vendor: VendorRow;
  ordersWon: number;
  ordersDelivered: number;
  reliability: ScoreResult;
  condition: ScoreResult;
  proof: ProofEntry[];
  source: LinkSource;
};

export async function loadScorecard(
  link: ResolvedLink,
  now: Date,
): Promise<{ ok: true; data: Scorecard } | { ok: false }> {
  if (link.source === "fixture") {
    return { ok: true, data: fixtureScorecard(link.vendor, now) };
  }
  try {
    const db = await client();
    const orders = await db
      .from("orders")
      .select("*")
      .eq("vendor_id", link.vendor.id);
    if (orders.error) return { ok: false };
    const orderRows = orders.data ?? [];
    if (orderRows.length === 0) {
      return {
        ok: true,
        data: {
          vendor: link.vendor,
          ordersWon: 0,
          ordersDelivered: 0,
          reliability: reliabilityScore([], { now }),
          condition: conditionScore([], { now }),
          proof: [],
          source: "db",
        },
      };
    }

    const [eventsRes, patientsRes] = await Promise.all([
      db
        .from("order_events")
        .select("*")
        .in("order_id", orderRows.map((o) => o.id))
        .order("created_at", { ascending: true }),
      db
        .from("patients")
        .select("id, first_name, last_name")
        .in("id", [...new Set(orderRows.map((o) => o.patient_id))]),
    ]);
    if (eventsRes.error || patientsRes.error) return { ok: false };

    const events = eventsRes.data ?? [];
    const patients = new Map((patientsRes.data ?? []).map((p) => [p.id, p]));
    const orderById = new Map(orderRows.map((o) => [o.id, o]));

    return {
      ok: true,
      data: {
        vendor: link.vendor,
        ordersWon: orderRows.length,
        ordersDelivered: orderRows.filter(
          (o) => o.status === "delivered" || o.status === "pickup_triggered" || o.status === "picked_up",
        ).length,
        reliability: reliabilityScore(events, { now }),
        condition: conditionScore(events, { now }),
        proof: buildProof(events, orderById, (id) => {
          const p = patients.get(id);
          return p ? `${p.first_name} ${p.last_name.slice(0, 1)}.` : "Patient";
        }),
        source: "db",
      },
    };
  } catch {
    return { ok: false };
  }
}

/** READ-ONLY evidence list. No PDF, no export — the events are the record. */
function buildProof(
  events: { order_id: string; type: string; payload: unknown; created_at: string }[],
  orders: Map<string, Pick<OrderRow, "order_no" | "patient_id">>,
  patientLabel: (patientId: string) => string,
): ProofEntry[] {
  return events
    .flatMap((e) => {
      if (e.type !== "delivered" && e.type !== "picked_up") return [];
      const order = orders.get(e.order_id);
      if (!order) return [];
      const payload = record(e.payload);
      return [
        {
          orderId: e.order_id,
          orderNo: order.order_no,
          kind: e.type as "delivered" | "picked_up",
          at: e.created_at,
          photoUrl: text(payload.pod_photo_url) ?? text(payload.condition_photo_url),
          signature: text(payload.signature_name) ?? text(payload.signature),
          patientLabel: patientLabel(order.patient_id),
        },
      ];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ---------------------------------------------------------------------------
// Catalog (onboarding + run list item names)
// ---------------------------------------------------------------------------

export async function loadCatalog(
  source: LinkSource,
): Promise<{ ok: true; rows: EquipmentRow[] } | { ok: false }> {
  if (source === "fixture") return { ok: true, rows: FIXTURE_CATALOG };
  try {
    const db = await client();
    const { data, error } = await db
      .from("equipment_catalog")
      .select("*")
      .order("category", { ascending: true })
      .order("plain_name", { ascending: true });
    if (error) return { ok: false };
    return { ok: true, rows: data ?? [] };
  } catch {
    return { ok: false };
  }
}

export const CATEGORY_LABEL: Record<string, string> = {
  bed: "Beds and positioning",
  respiratory: "Oxygen and breathing",
  mobility: "Wheelchairs and walkers",
  transfer: "Transfer and bathroom",
  consumable: "Supplies that reorder",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABEL[key] ?? key;
}

export const PRICING_MODELS = ["per_item_day", "per_patient_day"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export function isPricingModel(value: unknown): value is PricingModel {
  return (
    typeof value === "string" && (PRICING_MODELS as readonly string[]).includes(value)
  );
}

export type OnboardingInput = {
  inventory: Record<string, number>;
  pricingModel: PricingModel;
  serviceCenterZip: string;
  serviceRadiusMiles: number;
};

/** Writes exactly the four vendor columns amendment 11 added for onboarding v2. */
export async function saveOnboarding(
  vendorId: string,
  input: OnboardingInput,
  catalog: EquipmentRow[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const codes = new Set(catalog.map((c) => c.hcpcs));
  const inventory: Record<string, number> = {};
  for (const [hcpcs, qty] of Object.entries(input.inventory)) {
    if (!codes.has(hcpcs)) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    inventory[hcpcs] = Math.floor(qty);
  }
  const categories = [
    ...new Set(
      catalog.filter((c) => inventory[c.hcpcs] > 0).map((c) => c.category),
    ),
  ];
  if (categories.length === 0) {
    return { ok: false, message: "Add a quantity to at least one item." };
  }
  if (!/^\d{5}$/.test(input.serviceCenterZip)) {
    return { ok: false, message: "Enter the 5-digit ZIP your trucks leave from." };
  }
  if (!Number.isFinite(input.serviceRadiusMiles) || input.serviceRadiusMiles <= 0) {
    return { ok: false, message: "Enter how many miles you drive." };
  }

  try {
    const db = await client();
    const { error } = await db
      .from("vendors")
      .update({
        inventory: inventory as Json,
        pricing_model: input.pricingModel,
        service_center_zip: input.serviceCenterZip,
        service_radius_miles: Math.round(input.serviceRadiusMiles),
        categories,
        status: "active",
      })
      .eq("id", vendorId);
    if (error) return { ok: false, message: "We couldn't save that. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, message: "We couldn't save that. Try again." };
  }
}

// ---------------------------------------------------------------------------
// STUB pending SUPABASE_SERVICE_ROLE_KEY
// Everything below renders the four /v pages when there is no database to read.
// The query paths above are the real ones; deleting this block and the three
// `source === "fixture"` branches is the entire swap.
// ---------------------------------------------------------------------------

const FIXTURE_CATALOG: EquipmentRow[] = (
  [
    ["E0260", "Hospital bed (semi-electric)", "bed", false, false],
    ["E0184", "Pressure-relief mattress (foam overlay)", "bed", false, false],
    ["E0310", "Bed rails", "bed", false, false],
    ["E1390", "Oxygen concentrator", "respiratory", false, true],
    ["E0431", "Portable oxygen (gas cylinder)", "respiratory", true, true],
    ["E0601", "CPAP", "respiratory", false, true],
    ["E0600", "Suction machine", "respiratory", false, true],
    ["E1130", "Standard wheelchair", "mobility", false, false],
    ["E0143", "Folding wheeled walker", "mobility", false, false],
    ["E0630", "Patient lift (Hoyer) + sling", "transfer", false, false],
    ["E0163", "Bedside commode", "transfer", false, false],
    ["A4615", "Oxygen tubing and cannula kit", "consumable", false, false],
    ["T4527", "Incontinence briefs and underpads", "consumable", false, false],
  ] as const
).map(([hcpcs, plain_name, category, hazmat, time_critical]) => ({
  hcpcs,
  plain_name,
  category,
  serialized: category !== "consumable",
  hazmat,
  time_critical,
  resupply_interval_days: category === "consumable" ? 30 : hcpcs === "E0431" ? 14 : null,
  two_person: hcpcs === "E0630",
  image_url: null,
}));

function fixtureVendor(over: Partial<VendorRow> & { id: string; name: string }): VendorRow {
  return {
    dispatch_phone: "+13035550102",
    dispatch_email: "dispatch@example.com",
    hours: {},
    open_weekends: true,
    coverage_zips: ["80012", "80014", "80111"],
    categories: ["bed", "respiratory", "mobility", "transfer"],
    inventory: {},
    pricing_model: "per_item_day",
    service_center_zip: "80111",
    service_radius_miles: 50,
    hazmat_certified: true,
    status: "active",
    notes: null,
    created_at: "2026-04-16T00:00:00.000Z",
    ...over,
  };
}

const FIXTURE_VENDORS: Record<string, VendorRow> = {
  V2: fixtureVendor({
    id: "00000000-0000-4000-8000-000000000002",
    name: "Gulf Coast Home Medical",
  }),
  V3: fixtureVendor({
    id: "00000000-0000-4000-8000-000000000003",
    name: "ValueCare DME",
    open_weekends: false,
    hazmat_certified: false,
    service_center_zip: "80012",
    service_radius_miles: 25,
  }),
  V6: fixtureVendor({
    id: "00000000-0000-4000-8000-000000000006",
    name: "NorthStar Home Equipment",
    categories: [],
    service_center_zip: null,
    service_radius_miles: null,
    status: "invited",
  }),
};

/** Tokens match scripts/seed.mjs so the same URL behaves the same with or without a DB. */
const FIXTURE_LINKS: Record<
  string,
  { vendorKey: keyof typeof FIXTURE_VENDORS; scope: MagicLinkScope; expired?: boolean }
> = {
  "demo-run-list-v2-2026": { vendorKey: "V2", scope: "run_list" },
  "demo-run-list-v3-2026": { vendorKey: "V3", scope: "run_list" },
  "demo-report-card-v3": { vendorKey: "V3", scope: "report_card" },
  "demo-onboarding-v6-2026": { vendorKey: "V6", scope: "onboarding" },
  "demo-expired-link": { vendorKey: "V2", scope: "run_list", expired: true },
};

function resolveFixtureToken(token: string, now: Date): ResolveResult {
  const entry = FIXTURE_LINKS[token];
  if (!entry) return { status: "unknown" };
  if (entry.expired) return { status: "expired" };
  return {
    status: "ok",
    link: {
      token,
      scope: entry.scope,
      orderId: null,
      expiresAt: new Date(
        now.getTime() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString(),
      vendor: FIXTURE_VENDORS[entry.vendorKey],
      source: "fixture",
    },
  };
}

function hoursFromNow(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function fixtureStops(now: Date): VendorStop[] {
  return [
    {
      orderId: "fixture-10305",
      orderNo: "DME-10305",
      variant: "delivery",
      hazmat: false,
      status: "ordered",
      badges: ["AT_RISK"],
      patientLabel: "Maria S.",
      hospiceName: "Desert Valley Hospice",
      address: "171 Juniper Way, Aurora, CO 80111",
      addressNote: "Side door, gravel driveway",
      windowStart: hoursFromNow(now, 4),
      windowEnd: null,
      windowKind: "needed_by",
      items: [{ hcpcs: "E0600", plainName: "Suction machine", qty: 1 }],
      familyNote: null,
    },
    {
      orderId: "fixture-09911",
      orderNo: "DME-09911",
      variant: "pickup",
      hazmat: false,
      status: "pickup_triggered",
      badges: [],
      patientLabel: "Dorothy N.",
      hospiceName: "Desert Valley Hospice",
      address: "188 Juniper Way, Aurora, CO 80122",
      addressNote: null,
      windowStart: hoursFromNow(now, 2),
      windowEnd: hoursFromNow(now, 6),
      windowKind: "pickup_window",
      items: [
        { hcpcs: "E1130", plainName: "Standard wheelchair", qty: 1 },
        { hcpcs: "E0601", plainName: "CPAP", qty: 1 },
      ],
      familyNote: "Family asks for after 2 PM on Tuesday.",
    },
    {
      orderId: "fixture-10412",
      orderNo: "DME-10412",
      variant: "oxygen_swap",
      hazmat: true,
      status: "dispatched",
      badges: [],
      patientLabel: "Lucille G.",
      hospiceName: "Desert Valley Hospice",
      address: "256 Juniper Way, Aurora, CO 80016",
      addressNote: null,
      windowStart: hoursFromNow(now, 7),
      windowEnd: null,
      windowKind: "eta",
      items: [{ hcpcs: "E0431", plainName: "Portable oxygen (gas cylinder)", qty: 4 }],
      familyNote: null,
    },
  ];
}

/** Eight synthetic finished orders — enough to clear MIN_ORDERS_FOR_SCORE (5). */
function fixtureScorecard(vendor: VendorRow, now: Date): Scorecard {
  const unrated = vendor.status === "invited";
  const events: DerivableEvent[] = [];
  const orders = new Map<string, Pick<OrderRow, "order_no" | "patient_id">>();
  const names = ["Evelyn B.", "Walter K.", "Maria S.", "Robert M."];

  if (!unrated) {
    for (let i = 0; i < 8; i += 1) {
      const orderId = `fixture-hist-${i + 1}`;
      const placed = hoursFromNow(now, -(24 * (30 - i * 3)));
      const target = hoursFromNow(now, -(24 * (30 - i * 3)) + 20);
      const lateMin = i % 3 === 0 ? 95 : -40;
      const delivered = new Date(Date.parse(target) + lateMin * 60_000).toISOString();
      orders.set(orderId, { order_no: `HIST-${String(i + 1).padStart(3, "0")}`, patient_id: `p${i % 4}` });
      events.push(
        { order_id: orderId, type: "order_placed", created_at: placed, payload: { target_at: target } },
        { order_id: orderId, type: "vendor_notified", created_at: placed, payload: {} },
        {
          order_id: orderId,
          type: "vendor_confirmed",
          created_at: new Date(Date.parse(placed) + (i % 4) * 25 * 60_000).toISOString(),
          payload: { promised_eta: target },
        },
        { order_id: orderId, type: "eta_updated", created_at: placed, payload: { eta: target } },
        {
          order_id: orderId,
          type: "delivered",
          created_at: delivered,
          payload: {
            pod_photo_url: `https://placehold.co/800x600?text=POD+${i + 1}`,
            signature_name: "Synthetic recipient",
          },
        },
        {
          order_id: orderId,
          type: "condition_reported",
          created_at: delivered,
          payload: {
            phase: "delivery",
            functional: i !== 5,
            clean: i % 4 !== 1,
            repair: i === 5 ? "poor" : i % 3 === 0 ? "worn" : "good",
            issue: i === 5 ? "not_working" : i % 4 === 1 ? "dirty" : "none",
          },
        },
      );
      if (i % 3 === 0) {
        events.push({
          order_id: orderId,
          type: "at_risk_flagged",
          created_at: delivered,
          payload: { reason: "Synthetic history: ETA ran past the needed-by time." },
        });
      }
      if (i % 4 === 0) {
        const requested = new Date(Date.parse(delivered) + 96 * 3_600_000).toISOString();
        const pickedUp = new Date(Date.parse(requested) + (i === 0 ? 14 : 40) * 3_600_000).toISOString();
        events.push(
          { order_id: orderId, type: "pickup_requested", created_at: requested, payload: {} },
          {
            order_id: orderId,
            type: "picked_up",
            created_at: pickedUp,
            payload: { condition_photo_url: `https://placehold.co/800x600?text=Pickup+${i + 1}` },
          },
        );
      }
    }
  }

  return {
    vendor,
    ordersWon: unrated ? 0 : 8,
    ordersDelivered: unrated ? 0 : 8,
    reliability: reliabilityScore(events, { now }),
    condition: conditionScore(events, { now }),
    proof: buildProof(
      events.map((e) => ({
        order_id: String(e.order_id),
        type: e.type,
        payload: (e.payload ?? {}) as Json,
        created_at: e.created_at ?? now.toISOString(),
      })),
      orders,
      (id) => names[Number(id.slice(1)) % names.length],
    ),
    source: "fixture",
  };
}
