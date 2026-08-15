import "server-only";
import type { Database } from "@/src/types/db";
import type { DerivableEvent } from "@/src/lib/derive";
import { HOSPICE_TIMEZONE } from "@/src/lib/domain";
import {
  eventsByOrder,
  hasSupabaseEnv,
  type Loaded,
  type OrderEventRow,
  type OrderRow,
  type PatientRow,
} from "../patients/data";

type Tables = Database["public"]["Tables"];
export type VendorRow = Tables["vendors"]["Row"];

export type { Loaded, OrderRow, PatientRow };

/** One open order plus the patient it belongs to and its full event log. */
export type OrderCard = {
  order: OrderRow;
  patient: PatientRow;
  vendorName: string | null;
  events: DerivableEvent[];
  reason?: string;
};

function reasonOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const reason = (payload as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export type TodayData = {
  cards: OrderCard[];
  patients: PatientRow[];
  /** Orders whose patient status flipped inside the amber window. */
  recentStatusChangeOrderIds: Set<string>;
};

/** Matches specs/frontend.md 2.1 — "just went amber" is a 10-minute window. */
export const AMBER_WINDOW_MS = 10 * 60 * 1000;

/** Like Loaded<T>, but distinguishes missing env from a query failure. */
export type TodayLoaded<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no-env" | "error" };

async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

export async function loadToday(now: Date): Promise<TodayLoaded<TodayData>> {
  if (!hasSupabaseEnv()) return { ok: false, reason: "no-env" };
  try {
    const db = await client();
    const patients = await db
      .from("patients")
      .select("*")
      .order("last_name", { ascending: true });
    if (patients.error) return { ok: false, reason: "error" };
    const patientRows = patients.data ?? [];
    if (patientRows.length === 0) {
      return {
        ok: true,
        data: {
          cards: [],
          patients: [],
          recentStatusChangeOrderIds: new Set(),
        },
      };
    }

    const orders = await db
      .from("orders")
      .select("*")
      .in(
        "patient_id",
        patientRows.map((p) => p.id),
      )
      .neq("status", "picked_up")
      .order("target_at", { ascending: true, nullsFirst: false });
    if (orders.error) return { ok: false, reason: "error" };
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
      if (res.error) return { ok: false, reason: "error" };
      events = res.data ?? [];
    }

    const vendorIds = [
      ...new Set(orderRows.flatMap((o) => (o.vendor_id ? [o.vendor_id] : []))),
    ];
    const vendorNames = new Map<string, string>();
    if (vendorIds.length > 0) {
      const res = await db.from("vendors").select("id,name").in("id", vendorIds);
      if (res.error) return { ok: false, reason: "error" };
      for (const v of res.data ?? []) vendorNames.set(v.id, v.name);
    }

    const byPatient = new Map(patientRows.map((p) => [p.id, p]));
    const byOrder = eventsByOrder(events);

    const recentStatusChangeOrderIds = new Set<string>();
    for (const e of events) {
      if (e.type !== "patient_status_changed") continue;
      if (now.getTime() - Date.parse(e.created_at) <= AMBER_WINDOW_MS) {
        recentStatusChangeOrderIds.add(e.order_id);
      }
    }

    const cards: OrderCard[] = orderRows.flatMap((order) => {
      const patient = byPatient.get(order.patient_id);
      if (!patient) return [];
      const orderEvents = byOrder.get(order.id) ?? [];
      const flagged = [...orderEvents]
        .reverse()
        .find((e) => e.type === "at_risk_flagged");
      return [
        {
          order,
          patient,
          vendorName: order.vendor_id
            ? (vendorNames.get(order.vendor_id) ?? null)
            : null,
          events: orderEvents,
          reason: reasonOf(flagged?.payload) ?? undefined,
        },
      ];
    });

    return {
      ok: true,
      data: { cards, patients: patientRows, recentStatusChangeOrderIds },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOSPICE_TIMEZONE,
});

export function isSameDay(iso: string, now: Date): boolean {
  return DAY_KEY.format(new Date(iso)) === DAY_KEY.format(now);
}

export function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - Date.parse(iso)) / (60 * 60 * 1000);
}
