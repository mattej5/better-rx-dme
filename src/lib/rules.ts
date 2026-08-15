// src/lib/rules.ts
// Deterministic at-risk rules and helper to compute billing clock actions.
import { OrderEvent } from './derive';

export function evaluateAtRisk(order: any, events: OrderEvent[], settings: any) {
  // Rules (simplified):
  // - If there is an eta_updated that misses orders.target_at by > buffer => at risk
  // - If no vendor_confirmed within silence window after vendor_notified => at risk
  // Buffer depends on urgency
  const urgency = order?.urgency || 'routine';
  const buffers = { admission: 2, routine: 24, stat: 1 }; // hours
  const buffer = buffers[urgency] || 24;

  const etaEvent = events.find(e => e.type === 'eta_updated');
  if (etaEvent && order?.target_at) {
    try {
      const eta = new Date(etaEvent.payload?.eta);
      const target = new Date(order.target_at);
      const diffH = (eta.getTime() - target.getTime()) / (1000*60*60);
      if (diffH > 0 && diffH > buffer) {
        return { flag: true, reason: `ETA misses needed-by by ${Math.round(diffH)}h` };
      }
    } catch (e) {
      // fallthrough
    }
  }

  // Silence rule
  const notified = events.find(e => e.type === 'vendor_notified');
  const confirmed = events.find(e => e.type === 'vendor_confirmed');
  if (notified && !confirmed && settings && settings.silence_minutes) {
    const since = (Date.now() - new Date(notified.created_at).getTime()) / 60000;
    if (since > settings.silence_minutes) {
      return { flag: true, reason: `No vendor confirmation after ${Math.round(since)} minutes` };
    }
  }

  return { flag: false };
}

export function billingClockStart(payload: any) {
  // patient_status_changed payload => return pickup_requested payloads for serialized rentals
  // This function returns an array of order_event entries to append.
  const events: OrderEvent[] = [];
  const now = new Date().toISOString();
  if (payload && payload.patient_id && payload.orders && Array.isArray(payload.orders)) {
    payload.orders.forEach(o => {
      if (o.rental === 'serialized') {
        events.push({ id: `ev-${Math.random().toString(36).slice(2,9)}`, type: 'pickup_requested', created_at: now, payload: { order_id: o.order_id } });
      }
    });
  }
  return events;
}
