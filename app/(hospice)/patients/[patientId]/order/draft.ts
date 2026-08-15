import { HOSPICE_TIMEZONE } from "@/src/lib/domain";
import type { OrderUrgency } from "@/src/lib/domain";
import type { Database } from "@/src/types/db";

type Tables = Database["public"]["Tables"];
export type CatalogRow = Tables["equipment_catalog"]["Row"];
export type PriceRow = Tables["vendor_prices"]["Row"];

export type VendorOption = {
  id: string;
  name: string;
  openWeekends: boolean;
  reliability: number | "unrated";
  condition: number | "unrated";
};

export type OrderFlowData = {
  patientName: string;
  catalog: CatalogRow[];
  vendors: VendorOption[];
  prices: PriceRow[];
  thresholdCents: number;
  leadTimeHours: { stat: number; admission: number; routine: number };
  nowIso: string;
};

export type Loaded<T> = { ok: true; data: T } | { ok: false; missing?: true };

export const CATEGORY_ORDER = ["bed", "respiratory", "mobility", "transfer", "consumable"];

export const CATEGORY_LABEL: Record<string, string> = {
  bed: "Bed and positioning",
  respiratory: "Respiratory",
  mobility: "Mobility",
  transfer: "Transfer and bathroom",
  consumable: "Consumables",
};

/** Typical admission bundle. HCPCS match the seeded catalog. One order per item on submit. */
export const ADMISSION_BUNDLE = ["E0260", "E0184", "E1390", "E0163", "E0143"];

export type DraftItem = { hcpcs: string; qty: number };

export type OrderDraft = {
  items: DraftItem[];
  urgency: OrderUrgency;
  targetAt: string | null;
  vendorId: string | null;
};

export const EMPTY_DRAFT: OrderDraft = {
  items: [],
  urgency: "admission",
  targetAt: null,
  vendorId: null,
};

export function draftKey(patientId: string): string {
  return `orderDraft:${patientId}`;
}

export function readDraft(patientId: string): OrderDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(draftKey(patientId));
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<OrderDraft>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.flatMap((item) =>
          item && typeof item.hcpcs === "string"
            ? [{ hcpcs: item.hcpcs, qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1 }]
            : [],
        )
      : [];
    return {
      items,
      urgency:
        parsed.urgency === "routine" || parsed.urgency === "stat" || parsed.urgency === "admission"
          ? parsed.urgency
          : "admission",
      targetAt: typeof parsed.targetAt === "string" ? parsed.targetAt : null,
      vendorId: typeof parsed.vendorId === "string" ? parsed.vendorId : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(patientId: string, draft: OrderDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(patientId), JSON.stringify(draft));
  } catch {
    // A full or blocked sessionStorage must not break ordering.
  }
}

export function clearDraft(patientId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey(patientId));
  } catch {
    // Same reason as writeDraft.
  }
}

export type VendorOffer = {
  vendorId: string;
  vendorName: string;
  totalCents: number;
  etaIso: string;
  meetsDeadline: boolean;
  reliability: number | "unrated";
  condition: number | "unrated";
  openWeekends: boolean;
  allInStock: boolean;
};

/**
 * Vendors that carry every selected HCPCS, ranked reliability-first, then price.
 * Missing the deadline sinks a vendor to the bottom no matter how it scores.
 */
export function buildOffers(
  items: DraftItem[],
  vendors: VendorOption[],
  prices: PriceRow[],
  nowIso: string,
  targetAtIso: string | null,
): VendorOffer[] {
  if (items.length === 0) return [];
  const nowMs = Date.parse(nowIso);
  const targetMs = targetAtIso ? Date.parse(targetAtIso) : null;

  const offers: VendorOffer[] = [];
  for (const vendor of vendors) {
    const lines = items.map((item) =>
      prices.find((p) => p.vendor_id === vendor.id && p.hcpcs === item.hcpcs),
    );
    if (lines.some((line) => !line)) continue;

    let totalCents = 0;
    let leadHours = 0;
    let allInStock = true;
    lines.forEach((line, index) => {
      const price = line as PriceRow;
      totalCents += price.price_cents * items[index].qty;
      leadHours = Math.max(leadHours, price.lead_time_hours);
      if (!price.in_stock) allInStock = false;
    });

    const etaMs = nowMs + leadHours * 60 * 60 * 1000;
    offers.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      totalCents,
      etaIso: new Date(etaMs).toISOString(),
      meetsDeadline: targetMs === null ? true : etaMs <= targetMs,
      reliability: vendor.reliability,
      condition: vendor.condition,
      openWeekends: vendor.openWeekends,
      allInStock,
    });
  }

  return offers.sort((a, b) => {
    if (a.meetsDeadline !== b.meetsDeadline) return a.meetsDeadline ? -1 : 1;
    const ra = a.reliability === "unrated" ? -1 : a.reliability;
    const rb = b.reliability === "unrated" ? -1 : b.reliability;
    if (ra !== rb) return rb - ra;
    return a.totalCents - b.totalCents;
  });
}

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: HOSPICE_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function tzOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    PARTS.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** `2026-08-15T14:00` typed in the hospice's timezone becomes a UTC instant. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const naive = Date.parse(`${value}:00Z`);
  if (Number.isNaN(naive)) return null;
  const guess = new Date(naive);
  const adjusted = new Date(naive - tzOffsetMs(guess));
  return new Date(naive - tzOffsetMs(adjusted)).toISOString();
}

/** Inverse of localInputToIso, for the datetime-local field value. */
export function isoToLocalInput(iso: string): string {
  const instant = new Date(iso);
  const shifted = new Date(instant.getTime() + tzOffsetMs(instant));
  return shifted.toISOString().slice(0, 16);
}
