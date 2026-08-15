import "server-only";
import type { Database } from "@/src/types/db";
import type { OrderStatus } from "@/src/lib/domain";
import { ORDER_STATUSES } from "@/src/lib/domain";
import type { DerivableEvent } from "@/src/lib/derive";

type Tables = Database["public"]["Tables"];
export type PatientRow = Tables["patients"]["Row"];
export type OrderRow = Tables["orders"]["Row"];
export type OrderEventRow = Tables["order_events"]["Row"];
export type ResupplyRow = Tables["resupply_schedules"]["Row"];

export type OrderItem = { hcpcs: string; plain_name?: string; qty?: number };

/** Result wrapper so pages branch on missing env / query failure without throwing. */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * src/lib/supabase.ts asserts both env vars non-null at module scope, so importing
 * it without a service-role key throws at import time. Import it lazily and only
 * after the env check, which keeps the missing-key path a rendered ErrorState.
 */
async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

export function orderItems(items: OrderRow["items"]): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const rec = raw as Record<string, unknown>;
    const hcpcs = typeof rec.hcpcs === "string" ? rec.hcpcs : null;
    if (!hcpcs) return [];
    return [
      {
        hcpcs,
        plain_name:
          typeof rec.plain_name === "string" ? rec.plain_name : undefined,
        qty: typeof rec.qty === "number" ? rec.qty : undefined,
      },
    ];
  });
}

/** Lifecycle position — lower is less complete, so it sorts as the "worst" open order. */
export function statusRank(status: OrderStatus): number {
  return ORDER_STATUSES.indexOf(status);
}

export function eventsByOrder(
  events: OrderEventRow[],
): Map<string, DerivableEvent[]> {
  const map = new Map<string, DerivableEvent[]>();
  for (const e of events) {
    const list = map.get(e.order_id);
    if (list) list.push(e);
    else map.set(e.order_id, [e]);
  }
  return map;
}

export type RosterEntry = {
  patient: PatientRow;
  orders: OrderRow[];
  events: Map<string, DerivableEvent[]>;
};

export async function loadRoster(): Promise<Loaded<RosterEntry[]>> {
  if (!hasSupabaseEnv()) return { ok: false };
  try {
    const db = await client();
    const patients = await db
      .from("patients")
      .select("*")
      .order("last_name", { ascending: true });
    if (patients.error) return { ok: false };
    const rows = patients.data ?? [];
    if (rows.length === 0) return { ok: true, data: [] };

    const ids = rows.map((p) => p.id);
    const orders = await db.from("orders").select("*").in("patient_id", ids);
    if (orders.error) return { ok: false };
    const orderRows = orders.data ?? [];

    let events: OrderEventRow[] = [];
    if (orderRows.length > 0) {
      const res = await db
        .from("order_events")
        .select("*")
        .in(
          "order_id",
          orderRows.map((o) => o.id),
        )
        .order("created_at", { ascending: true });
      if (res.error) return { ok: false };
      events = res.data ?? [];
    }

    const byOrder = eventsByOrder(events);
    return {
      ok: true,
      data: rows.map((patient) => {
        const mine = orderRows.filter((o) => o.patient_id === patient.id);
        const scoped = new Map<string, DerivableEvent[]>();
        for (const o of mine) scoped.set(o.id, byOrder.get(o.id) ?? []);
        return { patient, orders: mine, events: scoped };
      }),
    };
  } catch {
    return { ok: false };
  }
}

export type PatientCard = {
  patient: PatientRow | null;
  orders: OrderRow[];
  events: Map<string, DerivableEvent[]>;
  resupply: ResupplyRow[];
};

export async function loadPatientCard(
  patientId: string,
): Promise<Loaded<PatientCard>> {
  if (!hasSupabaseEnv()) return { ok: false };
  try {
    const db = await client();
    const patient = await db
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .maybeSingle();
    // Invalid uuid text (Postgres 22P02) lands here too — treated as not found,
    // not as an error, so a mistyped link is a calm page rather than a red card.
    if (patient.error || !patient.data) {
      return {
        ok: true,
        data: { patient: null, orders: [], events: new Map(), resupply: [] },
      };
    }

    const orders = await db
      .from("orders")
      .select("*")
      .eq("patient_id", patientId)
      .order("ordered_at", { ascending: false });
    if (orders.error) return { ok: false };
    const orderRows = orders.data ?? [];

    let events: OrderEventRow[] = [];
    if (orderRows.length > 0) {
      const res = await db
        .from("order_events")
        .select("*")
        .in(
          "order_id",
          orderRows.map((o) => o.id),
        )
        .order("created_at", { ascending: true });
      if (res.error) return { ok: false };
      events = res.data ?? [];
    }

    const resupply = await db
      .from("resupply_schedules")
      .select("*")
      .eq("patient_id", patientId)
      .eq("active", true);
    if (resupply.error) return { ok: false };

    return {
      ok: true,
      data: {
        patient: patient.data,
        orders: orderRows,
        events: eventsByOrder(events),
        resupply: resupply.data ?? [],
      },
    };
  } catch {
    return { ok: false };
  }
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

export function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso));
}

export function daysSince(iso: string, now: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000)),
  );
}
