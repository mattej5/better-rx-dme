// N7 — vendor endpoint plumbing (engine.md §1.3).
//
// The token IS the auth. It resolves to a vendor_id and nothing else: no login,
// no cookie, no role. The dispatcher forwards the link to the driver on purpose
// (§1.2 — re-use is the feature), so these handlers must be safe to hit twice.
//
// Token resolution itself lives in src/lib/magic-link.ts (N6). This file adds
// the order-scoped half: which stop, does it belong to this vendor, and the
// append → runRules body every endpoint shares.
//
// Not a route file, so Next.js ignores it as a route segment.

import "server-only";

import { now } from "@/src/lib/clock";
import { appendEvent, type Actor } from "@/src/lib/events";
import { resolveToken, type ResolvedLink } from "@/src/lib/magic-link";
import { runRules } from "@/src/lib/rules";
import type { ConditionValue, EventType } from "@/src/lib/domain";
import type { Database, Json } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
export type OrderRow = Tables["orders"]["Row"];
export type PatientRow = Tables["patients"]["Row"];
export type EventRow = Tables["order_events"]["Row"];
export type CatalogRow = Tables["equipment_catalog"]["Row"];

/**
 * `order_events.actor_role` is a text column and the pinned `Role` union covers
 * hospice roles only — vendors have no role by contract (00-contracts.md).
 * Seeded vendor events already write `'vendor'`; match them rather than
 * mislabel a driver as a nurse.
 */
export function vendorActor(vendorName: string): Actor {
  return { role: "vendor", userName: vendorName } as unknown as Actor;
}

export type StopFailure = {
  status: number;
  error: string;
  /** Calm, driver-facing. Rendered as-is. */
  message: string;
};

export type ResolvedStop = {
  link: ResolvedLink;
  vendorId: string;
  vendorName: string;
  order: OrderRow;
  patient: PatientRow;
  events: EventRow[];
  catalog: CatalogRow[];
  /** Virtual demo clock at resolve time (src/lib/clock.ts). */
  at: Date;
};

export type Resolved<T> = { ok: true; data: T } | { ok: false; failure: StopFailure };

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function db() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

export const LINK_CLOSED: StopFailure = {
  status: 404,
  error: "unknown_token",
  message: "This link has expired. Ask the hospice to send a new one.",
};

/**
 * STUB pending SUPABASE_SERVICE_ROLE_KEY. magic-link.ts serves fixture stops so
 * the run list renders with no database; a write has nowhere to go, and saying
 * so is the only honest answer. Never return 200 here.
 */
export const NO_DATABASE: StopFailure = {
  status: 503,
  error: "no_database",
  message: "Nothing was saved — this preview has no database connected.",
};

export async function resolveStop(
  token: string,
  orderId?: string | null,
): Promise<Resolved<ResolvedStop>> {
  const at = await now();
  const resolved = await resolveToken(token, at);
  if (resolved.status !== "ok") {
    return {
      ok: false,
      failure:
        resolved.status === "expired"
          ? { ...LINK_CLOSED, status: 410, error: "expired_token" }
          : LINK_CLOSED,
    };
  }
  const link = resolved.link;
  if (link.source === "fixture") return { ok: false, failure: NO_DATABASE };

  const targetId = orderId ?? link.orderId;
  if (!targetId) {
    return {
      ok: false,
      failure: {
        status: 400,
        error: "missing_order",
        message: "We couldn't tell which stop this is. Open it from your list.",
      },
    };
  }

  try {
    const client = await db();
    const order = await client.from("orders").select("*").eq("id", targetId).maybeSingle();
    if (order.error || !order.data) {
      return {
        ok: false,
        failure: {
          status: 404,
          error: "unknown_order",
          message: "This stop is no longer on your list.",
        },
      };
    }
    // A vendor token may only touch that vendor's own stops.
    if (order.data.vendor_id !== link.vendor.id) {
      return {
        ok: false,
        failure: {
          status: 403,
          error: "wrong_vendor",
          message: "This stop belongs to another supplier.",
        },
      };
    }

    const [patient, events] = await Promise.all([
      client.from("patients").select("*").eq("id", order.data.patient_id).maybeSingle(),
      client
        .from("order_events")
        .select("*")
        .eq("order_id", order.data.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (patient.error || !patient.data || events.error) {
      return { ok: false, failure: NO_DATABASE };
    }

    const codes = itemCodes(order.data.items);
    let catalog: CatalogRow[] = [];
    if (codes.length > 0) {
      const rows = await client.from("equipment_catalog").select("*").in("hcpcs", codes);
      if (rows.error) return { ok: false, failure: NO_DATABASE };
      catalog = rows.data ?? [];
    }

    return {
      ok: true,
      data: {
        link,
        vendorId: link.vendor.id,
        vendorName: link.vendor.name,
        order: order.data,
        patient: patient.data,
        events: events.data ?? [],
        catalog,
        at,
      },
    };
  } catch {
    return { ok: false, failure: NO_DATABASE };
  }
}

export function itemCodes(items: Json): string[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const code = (raw as Record<string, unknown>).hcpcs;
    return typeof code === "string" ? [code] : [];
  });
}

/* ------------------------------------------------------------------ *
 * The shared POST body.
 * ------------------------------------------------------------------ */

export type EventPayload = Record<string, Json | undefined>;

export type VendorEventPlan = {
  type: EventType;
  payload: EventPayload;
};

export type VendorActionResult = {
  /** §1.3: one event per POST. `…/gps` is the single documented exception. */
  events: VendorEventPlan[];
  /** Denormalized columns on `orders` that mirror an event, if any. */
  orderPatch?: Tables["orders"]["Update"];
  /** Extra fields echoed to the driver's phone. */
  echo?: EventPayload;
};

export type VendorActionContext = {
  stop: ResolvedStop;
  body: Record<string, unknown>;
  actor: Actor;
  at: Date;
  atIso: string;
};

function json(body: Json, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function vendorAction(
  token: string,
  request: Request,
  build: (ctx: VendorActionContext) => VendorActionResult | Promise<VendorActionResult>,
  /** Runs after the append + runRules. Read-only work that needs the new log. */
  after?: (ctx: VendorActionContext) => Promise<EventPayload>,
): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  const resolved = await resolveStop(token, orderId);
  if (!resolved.ok) {
    return json(
      { error: resolved.failure.error, message: resolved.failure.message },
      resolved.failure.status,
    );
  }

  const stop = resolved.data;
  const actor = vendorActor(stop.vendorName);
  const ctx: VendorActionContext = {
    stop,
    body,
    actor,
    at: stop.at,
    atIso: stop.at.toISOString(),
  };

  let plan: VendorActionResult;
  try {
    plan = await build(ctx);
  } catch (error) {
    return json(
      {
        error: "invalid_request",
        message: error instanceof Error ? error.message : "We couldn't save that.",
      },
      400,
    );
  }

  try {
    for (const event of plan.events) {
      await appendEvent(stop.order.id, event.type, event.payload as Json, actor);
    }
    if (plan.orderPatch && Object.keys(plan.orderPatch).length > 0) {
      const client = await db();
      const patched = await client
        .from("orders")
        .update(plan.orderPatch)
        .eq("id", stop.order.id);
      if (patched.error) throw patched.error;
    }
    // §2.4: rules re-run after every vendor event.
    await runRules(stop.order.id);
  } catch (error) {
    return json(
      {
        error: "write_failed",
        message: error instanceof Error ? error.message : "We couldn't save that.",
      },
      500,
    );
  }

  let extra: EventPayload = {};
  if (after) {
    try {
      extra = await after(ctx);
    } catch {
      extra = {};
    }
  }

  return json(
    {
      ok: true,
      order_id: stop.order.id,
      order_no: stop.order.order_no,
      recorded_at: stop.at.toISOString(),
      events: plan.events.map((event) => event.type),
      ...(plan.echo ?? {}),
      ...extra,
    },
    200,
  );
}

/* ------------------------------------------------------------------ *
 * Small body readers. Every endpoint validates before it appends.
 * ------------------------------------------------------------------ */

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isoTime(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * No blob storage is configured for this build.
 * STUB pending object storage — the capture is inlined into the event payload as
 * a data URL. Production writes the bytes to storage and stores the URL instead.
 */
export const MAX_INLINE_CAPTURE_BYTES = 400_000;

export type CaptureRef = { url: string | null; stored: boolean; note?: string };

export function captureRef(value: unknown): CaptureRef {
  const raw = text(value);
  if (!raw) return { url: null, stored: false };
  if (raw.length > MAX_INLINE_CAPTURE_BYTES) {
    return {
      url: null,
      stored: false,
      note: "Captured on the phone but too large to inline; no blob storage configured.",
    };
  }
  return { url: raw, stored: true };
}

/**
 * The pinned proof-of-capture rule, in one place:
 *   signature (drawn OR typed name) OR photo — plus a timestamp, ALWAYS.
 * A pickup additionally requires the photo, because the condition of returned
 * equipment is the thing being proved.
 *
 * Throws rather than returning false so no caller can complete a stop by
 * ignoring the result. Server-side, so `curl` obeys it too.
 */
export function assertProofOfCapture(
  input: {
    signatureName?: string | null;
    signatureImageUrl?: string | null;
    photoUrl?: string | null;
    atIso: string;
  },
  opts: { requirePhoto?: boolean } = {},
): void {
  if (!input.atIso || !Number.isFinite(Date.parse(input.atIso))) {
    throw new Error("We couldn't stamp a time on this. Try again.");
  }
  if (opts.requirePhoto && !input.photoUrl) {
    throw new Error("Take a photo of the equipment before you mark it picked up.");
  }
  const hasSignature = Boolean(input.signatureName?.trim() || input.signatureImageUrl);
  if (!hasSignature && !input.photoUrl) {
    throw new Error("Add a signature or a photo before you mark this delivered.");
  }
}

/* ------------------------------------------------------------------ *
 * Condition mapping — the exact keys derive.ts/conditionScore() reads.
 * ------------------------------------------------------------------ */

export type ConditionPhase = "delivery" | "post_delivery";

const CONDITION_FACTS: Record<
  ConditionValue,
  { functional: boolean; clean: boolean; repair: "good" | "worn" | "poor"; issue: string }
> = {
  none: { functional: true, clean: true, repair: "good", issue: "none" },
  dirty: { functional: true, clean: false, repair: "worn", issue: "dirty" },
  damaged: { functional: true, clean: false, repair: "poor", issue: "damaged" },
  not_working: { functional: false, clean: true, repair: "poor", issue: "not_working" },
};

export function isConditionValue(value: unknown): value is ConditionValue {
  return (
    value === "none" || value === "dirty" || value === "damaged" || value === "not_working"
  );
}

/** Contracts amendment 7 — post-delivery issues reuse `condition_reported`. */
export function conditionPayload(
  value: ConditionValue,
  phase: ConditionPhase,
  extra: EventPayload = {},
): EventPayload {
  return { phase, ...CONDITION_FACTS[value], condition: value, ...extra };
}

/* ------------------------------------------------------------------ *
 * GPS → ETA. A supporting signal only (00-contracts.md).
 * ------------------------------------------------------------------ */

/** Straight-line miles per hour standing in for road speed. [assumed] */
export const ASSUMED_DRIVE_SPEED_MPH = 30;

export function destinationCoords(address: Json): { lat: number; lng: number } | null {
  if (!address || typeof address !== "object" || Array.isArray(address)) return null;
  const rec = address as Record<string, unknown>;
  const lat = finite(rec.lat);
  const lng = finite(rec.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
