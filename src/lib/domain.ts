export type OrderStatus =
  | 'ordered'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'pickup_triggered'
  | 'picked_up';

export type OrderUrgency = 'admission' | 'routine' | 'stat';

export type Badge = 'AT_RISK' | 'PICKUP_DELAYED';

export type EventType =
  | 'order_placed'
  | 'approval_requested'
  | 'approved'
  | 'denied'
  | 'vendor_notified'
  | 'vendor_confirmed'
  | 'vendor_declined'
  | 'dispatched'
  | 'gps_opted_in'
  | 'eta_updated'
  | 'at_risk_flagged'
  | 'at_risk_cleared'
  | 'escalated'
  | 'reordered'
  | 'delivered'
  | 'condition_reported'
  | 'patient_status_changed'
  | 'pickup_requested'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'message_sent'
  | 'message_received'
  | 'resupply_due';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'ordered',
  'dispatched',
  'in_transit',
  'delivered',
  'pickup_triggered',
  'picked_up',
];

export const ORDER_URGENCIES: readonly OrderUrgency[] = [
  'admission',
  'routine',
  'stat',
];

export const BADGES: readonly Badge[] = ['AT_RISK', 'PICKUP_DELAYED'];

export const EVENT_TYPES: readonly EventType[] = [
  'order_placed',
  'approval_requested',
  'approved',
  'denied',
  'vendor_notified',
  'vendor_confirmed',
  'vendor_declined',
  'dispatched',
  'gps_opted_in',
  'eta_updated',
  'at_risk_flagged',
  'at_risk_cleared',
  'escalated',
  'reordered',
  'delivered',
  'condition_reported',
  'patient_status_changed',
  'pickup_requested',
  'pickup_scheduled',
  'picked_up',
  'message_sent',
  'message_received',
  'resupply_due',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  ordered: 'Ordered',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered: 'Delivered',
  pickup_triggered: 'Pickup requested',
  picked_up: 'Picked up',
};

export const URGENCY_LABEL: Record<OrderUrgency, string> = {
  admission: 'Admission',
  routine: 'Routine',
  stat: 'STAT',
};

export const BADGE_LABEL: Record<Badge, string> = {
  AT_RISK: 'At risk',
  PICKUP_DELAYED: 'Pickup delayed',
};

export const EVENT_COPY: Record<EventType, string> = {
  order_placed: 'Order placed',
  approval_requested: 'Sent to DON for approval',
  approved: 'Approved by DON',
  denied: 'Denied by DON',
  vendor_notified: 'Vendor notified',
  vendor_confirmed: 'Vendor confirmed',
  vendor_declined: 'Vendor declined',
  dispatched: 'Vendor dispatched a driver',
  gps_opted_in: 'Driver shared location',
  eta_updated: 'ETA updated',
  at_risk_flagged: 'Flagged at risk',
  at_risk_cleared: 'No longer at risk',
  escalated: 'Escalated',
  reordered: 'Reordered from backup vendor',
  delivered: 'Delivered',
  condition_reported: 'Condition reported',
  patient_status_changed: 'Patient status changed',
  pickup_requested: 'Pickup requested',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  message_sent: 'Message sent to vendor',
  message_received: 'Vendor replied',
  resupply_due: 'Resupply due',
};

export type StopVariant = 'delivery' | 'pickup' | 'oxygen_swap';

export type ConditionValue = 'none' | 'dirty' | 'damaged' | 'not_working';

export const CONDITION_LABEL: Record<ConditionValue, string> = {
  none: 'None',
  dirty: 'Dirty',
  damaged: 'Damaged',
  not_working: 'Not working',
};

export type TimelineEvent = {
  id: string | number;
  type: EventType | (string & {});
  at: string;
  actor?: string | null;
  detail?: string | null;
  message?: {
    direction: 'outbound' | 'inbound';
    body: string;
    who: string;
  };
  parsed?: {
    line: string;
    confidence: number;
  };
};

// [assumed] engine.md pins settings-seeded tz America/Denver; T1 seeds it — swap to a settings read when the engine lands.
export const HOSPICE_TIMEZONE = 'America/Denver';

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: HOSPICE_TIMEZONE,
  }).format(new Date(iso));
}

export function formatDayTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: HOSPICE_TIMEZONE,
  }).format(new Date(iso));
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** vendor_prices.price_cents is a MONTHLY rental. Daily rate = /30, ASSUMED. */
export const ASSUMED_DAYS_PER_MONTH = 30;

export function perDayCents(monthlyCents: number): number {
  return Math.round(monthlyCents / ASSUMED_DAYS_PER_MONTH);
}
