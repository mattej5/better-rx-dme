// STUB — T3 (Tony) owns this file; replace wholesale when the real derive.ts lands.
// Contract: pure functions over order_events rows. No score math lives here.
// Only awaitingApproval() is real — contracts amendment 1 pins it and it is trivial.
// T3: expose the at_risk_flagged reason to consumers — pages currently read payload.reason off the raw event log directly.

import type { Badge } from "@/src/lib/domain";

/** Structural shape satisfied by a Supabase `order_events` Row. */
export type DerivableEvent = {
  type: string;
  created_at?: string;
  order_id?: string;
  payload?: unknown;
};

export type ScoreBreakdown = {
  variable: string;
  value: number;
  weight: number;
};

export type ScoreResult = {
  score: number | null;
  label: string;
  n_orders: number;
  breakdown: ScoreBreakdown[];
  synthetic: true;
};

const UNRATED: ScoreResult = {
  score: null,
  label: "Unrated",
  n_orders: 0,
  breakdown: [],
  synthetic: true,
};

/** STUB: always []. Real rules read at_risk_flagged / at_risk_cleared and pickup age. */
export function deriveBadges(_events: DerivableEvent[]): Badge[] {
  return [];
}

/** Real: approval_requested present with no approved/denied (contracts amendment 1). */
export function awaitingApproval(events: DerivableEvent[]): boolean {
  let requested = false;
  for (const e of events) {
    if (e.type === "approved" || e.type === "denied") return false;
    if (e.type === "approval_requested") requested = true;
  }
  return requested;
}

/** STUB: always Unrated. */
export function reliabilityScore(_events: DerivableEvent[]): ScoreResult {
  return UNRATED;
}

/** STUB: always Unrated. */
export function conditionScore(_events: DerivableEvent[]): ScoreResult {
  return UNRATED;
}
