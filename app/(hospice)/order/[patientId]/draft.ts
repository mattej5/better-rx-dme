// The order draft lives in sessionStorage until PLACE ORDER — no server round-trip
// between steps, so the browser Back button and a dropped signal both behave.
// specs/frontend.md 2.2: key is `orderDraft:<patientId>`.

import type { OrderUrgency } from "@/src/lib/domain";
import type { CategoryKey } from "./types";

export type DraftItem = {
  hcpcs: string;
  plainName: string;
  category: CategoryKey;
  qty: number;
};

export type OrderDraft = {
  items: DraftItem[];
  urgency: OrderUrgency | null;
  /** Local datetime-local value, e.g. "2026-08-15T14:00". Becomes orders.target_at. */
  targetAt: string;
  reason: string;
  vendorId: string | null;
  fromBundle: boolean;
};

export const EMPTY_DRAFT: OrderDraft = {
  items: [],
  urgency: null,
  targetAt: "",
  reason: "",
  vendorId: null,
  fromBundle: false,
};

export function draftKey(patientId: string): string {
  return `orderDraft:${patientId}`;
}

function isUrgency(value: unknown): value is OrderUrgency {
  return value === "admission" || value === "routine" || value === "stat";
}

export function readDraft(patientId: string): OrderDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(draftKey(patientId));
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_DRAFT;
    const rec = parsed as Record<string, unknown>;
    const items = Array.isArray(rec.items)
      ? rec.items.flatMap((raw2): DraftItem[] => {
          if (!raw2 || typeof raw2 !== "object") return [];
          const item = raw2 as Record<string, unknown>;
          if (typeof item.hcpcs !== "string") return [];
          return [
            {
              hcpcs: item.hcpcs,
              plainName: typeof item.plainName === "string" ? item.plainName : item.hcpcs,
              category: (typeof item.category === "string" ? item.category : "bed") as CategoryKey,
              qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1,
            },
          ];
        })
      : [];
    return {
      items,
      urgency: isUrgency(rec.urgency) ? rec.urgency : null,
      targetAt: typeof rec.targetAt === "string" ? rec.targetAt : "",
      reason: typeof rec.reason === "string" ? rec.reason : "",
      vendorId: typeof rec.vendorId === "string" ? rec.vendorId : null,
      fromBundle: rec.fromBundle === true,
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
    // A full or disabled sessionStorage must not break the flow; the draft just
    // stops surviving a reload.
  }
}

export function clearDraft(patientId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey(patientId));
  } catch {
    // Same reasoning as writeDraft.
  }
}

/** "2026-08-15T14:00" in the browser's local time — the value an <input> expects. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Local input value → ISO, or null when the field is empty or unparseable. */
export function toIso(localValue: string): string | null {
  if (!localValue) return null;
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
