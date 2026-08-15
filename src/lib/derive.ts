// src/lib/derive.ts
// Pure functions to compute reliability/condition scores and badges from order_events.
// This file is the engine lane's shared contract: frontend imports these functions and uses their outputs.

export type OrderEvent = {
  id: string;
  order_id?: string;
  type: string;
  created_at: string;
  payload?: any;
};

export function reliabilityScore(events: OrderEvent[]): number {
  // Simple deterministic heuristic: confirmations / (confirmations + declines + 1)
  const confirmed = events.filter(e => e.type === 'vendor_confirmed').length;
  const declined = events.filter(e => e.type === 'vendor_declined').length;
  const dispatched = events.filter(e => e.type === 'dispatched').length;
  const score = Math.min(1, (confirmed + dispatched) / (confirmed + declined + dispatched + 1));
  return Math.round(score * 100) / 100;
}

export function conditionScore(events: OrderEvent[]): number {
  // Heuristic: fewer condition_reported (damaged) => higher score.
  const reports = events.filter(e => e.type === 'condition_reported').length;
  const delivered = events.filter(e => e.type === 'delivered').length;
  if (delivered === 0) return 0.5; // unrated-ish
  const score = Math.max(0, 1 - reports / (delivered + 1));
  return Math.round(score * 100) / 100;
}

export function awaitingApproval(events: OrderEvent[]): boolean {
  return events.some(e => e.type === 'approval_requested') && !events.some(e => e.type === 'approved' || e.type === 'denied');
}

export function computeBadges(events: OrderEvent[], settings: any): { atRisk: boolean; pickupDelayed: boolean; reason?: string } {
  // Very simple rules: if an at_risk_flagged event exists and not cleared => at risk.
  const atRiskEvent = events.find(e => e.type === 'at_risk_flagged');
  const atRiskCleared = events.find(e => e.type === 'at_risk_cleared');
  const pickupTriggered = events.find(e => e.type === 'pickup_requested');
  const lastEvent = events.length ? events[events.length - 1] : null;

  const atRisk = !!atRiskEvent && !atRiskCleared;
  const pickupDelayed = !!pickupTriggered && (() => {
    if (!settings) return false;
    const amber = settings.pickup_amber_h || 24;
    const red = settings.pickup_red_h || 48;
    // if now - pickup_requested > amber -> delayed; > red -> severe. But without a demo clock, check payload.elapsed_hours
    if (pickupTriggered.payload && typeof pickupTriggered.payload.elapsed_hours === 'number') {
      return pickupTriggered.payload.elapsed_hours >= amber;
    }
    return false;
  })();

  return { atRisk, pickupDelayed, reason: atRiskEvent ? atRiskEvent.payload?.reason : undefined };
}
