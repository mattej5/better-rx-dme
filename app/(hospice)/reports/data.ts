import "server-only";
import { conditionScore, reliabilityScore, type ScoreResult } from "@/src/lib/derive";
import type { DerivableEvent } from "@/src/lib/derive";
import { HOSPICE_TIMEZONE, perDayCents } from "@/src/lib/domain";
import { SETTING_DEFAULTS } from "@/src/lib/settings-defaults";
import { equipmentDaysSaved, type EquipmentSavedResult } from "@/src/lib/billing";
import {
  eventsByOrder,
  hasSupabaseEnv,
  type OrderEventRow,
  type OrderRow,
  type PatientRow,
} from "../patients/data";

/** SYNTHETIC fallback when settings has no med_ppd_synthetic row. Cents per patient-day. */
export const MED_PPD_SYNTHETIC_CENTS = 1_050;

export type ReportsLoaded<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no-env" | "error" };

export type PatientPpd = {
  patientId: string;
  name: string;
  censusDays: number;
  spendCents: number;
  ppdCents: number | null;
};

export type VendorScorecard = {
  vendorId: string;
  name: string;
  orders: number;
  orders30: number;
  reliability: ScoreResult;
  condition: ScoreResult;
};

export type ReportsData = {
  monthLabel: string;
  censusDays: number;
  spendCents: number;
  ppdCents: number | null;
  medPpdCents: number;
  medPpdFromSettings: boolean;
  patients: PatientPpd[];
  vendors: VendorScorecard[];
  baselineNotifyLagH: number;
  ordersExcludedNoPrice: number;
  saved: EquipmentSavedResult;
  saved30: EquipmentSavedResult;
  savedYear: EquipmentSavedResult;
};

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOSPICE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: HOSPICE_TIMEZONE,
  month: "long",
  year: "numeric",
});

/** Calendar day in the hospice timezone, as days since epoch — census math is day-based. */
function dayNum(key: string): number {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

function dayKey(iso: string): string {
  return DAY_KEY.format(new Date(iso));
}

function monthBounds(now: Date) {
  const today = DAY_KEY.format(now);
  const [year, month] = today.split("-").map(Number);
  const first = `${today.slice(0, 7)}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return {
    firstDay: dayNum(first),
    lastDay: dayNum(nextMonth) - 1,
    todayDay: dayNum(today),
    prefix: today.slice(0, 7),
    label: MONTH_LABEL.format(now),
  };
}

/**
 * V8 audit fix: census-days = days on service inside the reporting month,
 * admitted_at through discharge_at or month end, capped at the virtual clock
 * so a mid-month view never counts days that have not happened.
 */
function censusDaysFor(
  patient: PatientRow,
  bounds: ReturnType<typeof monthBounds>,
): number {
  if (!patient.admitted_at) return 0;
  const cap = Math.min(bounds.lastDay, bounds.todayDay);
  const start = Math.max(dayNum(dayKey(patient.admitted_at)), bounds.firstDay);
  const end = Math.min(
    patient.discharge_at ? dayNum(dayKey(patient.discharge_at)) : cap,
    cap,
  );
  return end >= start ? end - start + 1 : 0;
}

/**
 * Daily-accrual spend for one order inside the reporting month: days = inclusive
 * day count from max(ordered_at day, month start) to min(virtual-today day, month
 * end), capped at picked_up_at when present. Returns 0 for orders that have no
 * overlap with the month (e.g. ordered after the reporting window, or picked up
 * before month start).
 */
function orderAccrualDays(
  order: OrderRow,
  bounds: ReturnType<typeof monthBounds>,
): number {
  const cap = Math.min(bounds.lastDay, bounds.todayDay);
  const start = Math.max(dayNum(dayKey(order.ordered_at)), bounds.firstDay);
  const end = order.picked_up_at
    ? Math.min(cap, dayNum(dayKey(order.picked_up_at)))
    : cap;
  return end >= start ? end - start + 1 : 0;
}

function orderAccrualCents(order: OrderRow, bounds: ReturnType<typeof monthBounds>): number {
  if (order.price_cents == null) return 0;
  return perDayCents(order.price_cents) * orderAccrualDays(order, bounds);
}

async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

function settingNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadReports(now: Date): Promise<ReportsLoaded<ReportsData>> {
  if (!hasSupabaseEnv()) return { ok: false, reason: "no-env" };
  try {
    const bounds = monthBounds(now);
    const db = await client();

    const [patientsRes, ordersRes, vendorsRes, settingsRes] = await Promise.all([
      db.from("patients").select("*").order("last_name", { ascending: true }),
      db.from("orders").select("*"),
      db.from("vendors").select("id,name").order("name", { ascending: true }),
      db.from("settings").select("key, value"),
    ]);
    if (patientsRes.error || ordersRes.error || vendorsRes.error || settingsRes.error) {
      return { ok: false, reason: "error" };
    }

    const patientRows: PatientRow[] = patientsRes.data ?? [];
    const orderRows: OrderRow[] = ordersRes.data ?? [];

    let medPpdCents = MED_PPD_SYNTHETIC_CENTS;
    let medPpdFromSettings = false;
    let baselineNotifyLagH: number = SETTING_DEFAULTS.baseline_notify_lag_h;
    for (const row of settingsRes.data ?? []) {
      const num = settingNumber(row.value);
      if (num === null) continue;
      if (row.key === "med_ppd_synthetic") {
        medPpdCents = num;
        medPpdFromSettings = true;
      } else if (row.key === "baseline_notify_lag_h") {
        baselineNotifyLagH = num;
      }
    }

    const spendByPatient = new Map<string, number>();
    let ordersExcludedNoPrice = 0;
    for (const order of orderRows) {
      if (order.price_cents == null) {
        ordersExcludedNoPrice += 1;
        continue;
      }
      const cents = orderAccrualCents(order, bounds);
      if (cents === 0) continue;
      spendByPatient.set(
        order.patient_id,
        (spendByPatient.get(order.patient_id) ?? 0) + cents,
      );
    }

    const patients: PatientPpd[] = patientRows.flatMap((p) => {
      const censusDays = censusDaysFor(p, bounds);
      const spendCents = spendByPatient.get(p.id) ?? 0;
      if (censusDays === 0 && spendCents === 0) return [];
      return [
        {
          patientId: p.id,
          name: `${p.first_name} ${p.last_name}`,
          censusDays,
          spendCents,
          ppdCents: censusDays > 0 ? spendCents / censusDays : null,
        },
      ];
    });

    const censusDays = patients.reduce((sum, p) => sum + p.censusDays, 0);
    const spendCents = patients.reduce((sum, p) => sum + p.spendCents, 0);

    let events: OrderEventRow[] = [];
    if (orderRows.length > 0) {
      const res = await db
        .from("order_events")
        .select("*")
        .in("order_id", orderRows.map((o) => o.id))
        .order("created_at", { ascending: true });
      if (res.error) return { ok: false, reason: "error" };
      events = res.data ?? [];
    }
    const byOrder = eventsByOrder(events);

    const vendors: VendorScorecard[] = (vendorsRes.data ?? []).map((v) => {
      const mine = orderRows.filter((o) => o.vendor_id === v.id);
      const cutoff30 = now.getTime() - 30 * 24 * 3_600_000;
      const mine30 = mine.filter((o) => Date.parse(o.ordered_at) >= cutoff30);
      const vendorEvents: DerivableEvent[] = mine.flatMap(
        (o) => byOrder.get(o.id) ?? [],
      );
      return {
        vendorId: v.id,
        name: v.name,
        orders: mine.length,
        orders30: mine30.length,
        reliability: reliabilityScore(vendorEvents, { now }),
        condition: conditionScore(vendorEvents, { now }),
      };
    });

    const toSavedInput = (rows: OrderRow[]) =>
      rows.map((o) => ({
        id: o.id,
        price_cents: o.price_cents,
        events: byOrder.get(o.id) ?? [],
      }));
    const cutoff30saved = now.getTime() - 30 * 24 * 3_600_000;
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const pickupAfter = (cutoff: number) =>
      orderRows.filter(
        (o) => o.pickup_requested_at && Date.parse(o.pickup_requested_at) >= cutoff,
      );
    const saved30 = equipmentDaysSaved(toSavedInput(pickupAfter(cutoff30saved)), { baselineNotifyLagH });
    const savedYear = equipmentDaysSaved(toSavedInput(pickupAfter(yearStart)), { baselineNotifyLagH });
    const saved = equipmentDaysSaved(
      toSavedInput(orderRows),
      { baselineNotifyLagH },
    );

    return {
      ok: true,
      data: {
        monthLabel: bounds.label,
        censusDays,
        spendCents,
        ppdCents: censusDays > 0 ? spendCents / censusDays : null,
        medPpdCents,
        medPpdFromSettings,
        patients,
        vendors,
        baselineNotifyLagH,
        ordersExcludedNoPrice,
        saved,
        saved30,
        savedYear,
      },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}
