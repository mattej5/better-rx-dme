import "server-only";
import { deriveBadges } from "@/src/lib/derive";
import { formatDayTime } from "@/src/lib/domain";
import { orderItems } from "../patients/data";
import { loadSettings } from "../settings/data";
import {
  hoursSince,
  loadToday,
  type OrderCard,
  type PatientRow,
  type TodayData,
  type TodayLoaded,
} from "../today/data";

export type { PatientRow, TodayLoaded };

const NEW_ADMISSION_HOURS = 48;

export type BundleItem = { hcpcs: string; plainName: string };

/** Preset per specs/frontend.md 2.2; codes from wiki/facts/dme-catalog.md. */
export const ADMISSION_BUNDLE: readonly BundleItem[] = [
  { hcpcs: "E0260", plainName: "Hospital bed" },
  { hcpcs: "E0184", plainName: "Pressure mattress" },
  { hcpcs: "E1390", plainName: "Oxygen concentrator" },
  { hcpcs: "E0163", plainName: "Bedside commode" },
  { hcpcs: "E0143", plainName: "Walker" },
];

export type CellTone = "green" | "amber" | "red" | "none";

export type Cell = {
  hcpcs: string;
  tone: CellTone;
  /** Always rendered. Color never carries meaning on its own. */
  label: string;
  when?: string;
  orderId?: string;
  reason?: string;
  targetAt?: string | null;
};

export type ReadinessRow = {
  patient: PatientRow;
  note: string;
  openCount: number;
  cells: Cell[];
  blocked?: { orderId: string; reason: string };
};

export type ReadinessBoard = {
  columns: BundleItem[];
  rows: ReadinessRow[];
  amberMarginMin: number;
};

const TONE_RANK: Record<CellTone, number> = {
  red: 0,
  amber: 1,
  green: 2,
  none: 3,
};

function columnsFor(cards: OrderCard[]): BundleItem[] {
  const seen = new Map(ADMISSION_BUNDLE.map((c) => [c.hcpcs, c]));
  const extras: BundleItem[] = [];
  for (const card of cards) {
    for (const item of orderItems(card.order.items)) {
      if (seen.has(item.hcpcs)) continue;
      const col = { hcpcs: item.hcpcs, plainName: item.plain_name ?? item.hcpcs };
      seen.set(item.hcpcs, col);
      extras.push(col);
    }
  }
  extras.sort((a, b) => a.plainName.localeCompare(b.plainName));
  return [...ADMISSION_BUNDLE, ...extras];
}

function cellFrom(
  card: OrderCard,
  hcpcs: string,
  at: Date,
  marginMs: number,
  recentIds: Set<string>,
): Cell {
  const { order } = card;
  const badge = deriveBadges(card.events)[0];
  const eta = order.current_eta ?? order.target_at;
  const base = {
    hcpcs,
    orderId: order.id,
    when: eta ? formatDayTime(eta) : undefined,
    targetAt: order.target_at,
    reason: card.reason,
  };

  if (badge === "AT_RISK") return { ...base, tone: "red", label: "At risk" };
  if (badge === "PICKUP_DELAYED")
    return { ...base, tone: "red", label: "Pickup delayed" };
  if (order.status === "picked_up")
    return { ...base, tone: "green", label: "Picked up" };
  if (order.status === "delivered")
    return { ...base, tone: "green", label: "Delivered" };
  if (recentIds.has(order.id))
    return { ...base, tone: "amber", label: "Dates moved" };
  if (
    order.target_at &&
    Date.parse(order.target_at) - at.getTime() <= marginMs
  ) {
    return { ...base, tone: "amber", label: "Due soon" };
  }
  return { ...base, tone: "green", label: "On track" };
}

function noteFor(patient: PatientRow, at: Date): string {
  if (patient.discharge_at) return `Discharge ${formatDayTime(patient.discharge_at)}`;
  if (patient.admitted_at) return `Admitted ${formatDayTime(patient.admitted_at)}`;
  void at;
  return "No admission date on file";
}

function inScope(patient: PatientRow, cards: OrderCard[], at: Date): boolean {
  if (patient.admitted_at && hoursSince(patient.admitted_at, at) <= NEW_ADMISSION_HOURS)
    return true;
  if (patient.discharge_at && Date.parse(patient.discharge_at) >= at.getTime())
    return true;
  return cards.some((c) => c.order.target_at !== null);
}

export function buildBoard(
  data: TodayData,
  at: Date,
  amberMarginMin: number,
): ReadinessBoard {
  const marginMs = amberMarginMin * 60 * 1000;
  const columns = columnsFor(data.cards);

  const byPatient = new Map<string, OrderCard[]>();
  for (const card of data.cards) {
    const list = byPatient.get(card.patient.id);
    if (list) list.push(card);
    else byPatient.set(card.patient.id, [card]);
  }

  const rows: ReadinessRow[] = [];
  for (const patient of data.patients) {
    const cards = byPatient.get(patient.id) ?? [];
    if (!inScope(patient, cards, at)) continue;

    const cells = columns.map((column) => {
      const candidates = cards
        .filter((card) =>
          orderItems(card.order.items).some((i) => i.hcpcs === column.hcpcs),
        )
        .map((card) =>
          cellFrom(card, column.hcpcs, at, marginMs, data.recentStatusChangeOrderIds),
        )
        .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
      return (
        candidates[0] ?? {
          hcpcs: column.hcpcs,
          tone: "none" as const,
          label: "Not ordered",
        }
      );
    });

    const blocking = cells.find(
      (c) =>
        c.tone === "red" &&
        c.orderId &&
        c.targetAt &&
        Date.parse(c.targetAt) - at.getTime() <= marginMs,
    );

    rows.push({
      patient,
      note: noteFor(patient, at),
      openCount: cards.length,
      cells,
      blocked: blocking?.orderId
        ? {
            orderId: blocking.orderId,
            reason:
              blocking.reason ??
              "Equipment will not arrive before this patient's discharge time.",
          }
        : undefined,
    });
  }

  rows.sort(
    (a, b) => Number(Boolean(b.blocked)) - Number(Boolean(a.blocked)),
  );

  return { columns, rows, amberMarginMin };
}

export async function loadReadiness(
  at: Date,
): Promise<TodayLoaded<ReadinessBoard>> {
  const result = await loadToday(at);
  if (!result.ok) return result;
  const settings = await loadSettings();
  return {
    ok: true,
    data: buildBoard(result.data, at, settings.values.eta_amber_margin_min),
  };
}
