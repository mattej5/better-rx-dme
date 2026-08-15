// Shared shapes + copy for the order flow. Deliberately free of `server-only` so the
// client steps can import it; data.ts (server) re-exports everything here.

import type { ScoreResult } from "@/src/lib/derive";
import type { OrderUrgency } from "@/src/lib/domain";

export type CategoryKey = "bed" | "respiratory" | "mobility" | "transfer" | "consumable";

export const CATEGORY_ORDER: CategoryKey[] = [
  "bed",
  "respiratory",
  "mobility",
  "transfer",
  "consumable",
];

/** Plain names first (grandma rule); the E-code is the small secondary line. */
export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  bed: "Bed and positioning",
  respiratory: "Breathing and oxygen",
  mobility: "Getting around",
  transfer: "Transfers and bathroom",
  consumable: "Supplies",
};

export const CATEGORY_HINT: Record<CategoryKey, string> = {
  bed: "Beds, mattresses, rails",
  respiratory: "Oxygen, suction, CPAP",
  mobility: "Wheelchairs, walkers, canes",
  transfer: "Lifts, commodes, shower chairs",
  consumable: "Dressings, briefs, tubing",
};

/** Preset per specs/frontend.md 2.2. One order per item — contracts amendment 3. */
export const ADMISSION_BUNDLE_CODES = ["E0260", "E0184", "E1390", "E0163", "E0143"];

export type CatalogItem = {
  hcpcs: string;
  plainName: string;
  category: CategoryKey;
  hazmat: boolean;
  timeCritical: boolean;
  imageUrl: string | null;
};

export type VendorPrice = {
  /** vendor_prices.price_cents — a MONTHLY rental. Screens divide by 30, labeled ASSUMED. */
  monthlyCents: number;
  inStock: boolean;
  leadTimeHours: number;
};

export type VendorOption = {
  id: string;
  name: string;
  openWeekends: boolean;
  hazmatCertified: boolean;
  dispatchPhone: string | null;
  prices: Record<string, VendorPrice>;
  /** From derive.ts. Never computed in this lane. */
  reliability: ScoreResult;
  condition: ScoreResult;
};

export type OrderContextData = {
  source: "database" | "fixture";
  patient: { id: string; firstName: string; lastName: string; medRecNo: string | null } | null;
  catalog: CatalogItem[];
  vendors: VendorOption[];
  donThresholdCents: number;
  donThresholdFromSettings: boolean;
  leadTimeHours: Record<OrderUrgency, number>;
};

export function isCategory(value: string): value is CategoryKey {
  return CATEGORY_ORDER.includes(value as CategoryKey);
}

/** `?step=` drives the flow so browser Back works and /demo can deep-link a step. */
export type FlowStep = "items" | "when" | "vendor";

export function isFlowStep(value: string | undefined): value is FlowStep {
  return value === "items" || value === "when" || value === "vendor";
}
