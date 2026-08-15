/**
 * Escalation nudge ladder — specs/engine.md §2.6, specs/00-contracts.md amendment 9.
 *
 * PURE. No I/O, no DB, no network, no Date.now(). It appends nothing and
 * decides nothing about at-risk. It answers exactly one question:
 *
 *   "Given this event log and this instant, which ladder steps are DUE and have
 *    not been sent yet?"
 *
 * It never asks "how many ticks have elapsed", which is what makes it idempotent
 * under the demo clock's arbitrary jumps: advancing 60 minutes in one jump
 * produces the same set of steps — and therefore the same event log — as six
 * 10-minute jumps.
 *
 * Ladder state is DERIVED BY COUNTING EVENTS, never stored. There is no
 * `nudge_sent` event type in the pinned union and we do not add one: every step
 * marker is an existing event carrying `payload.kind='nudge'` and
 * `payload.ladder_step`.
 *
 * Ownership boundaries:
 *   - This module returns intent. The CALLER (T7 sweep / demo advance) appends.
 *   - `src/lib/rules.ts` owns at_risk_flagged / at_risk_cleared. The `emits`
 *     field below is a description of the step, not permission to write the
 *     event directly.
 *   - `sendMessage()` (N2) owns transport.
 */

import type { TemplateId, TemplateVars } from './message-templates.ts';

/** Pinned, specs/00-contracts.md. */
export type OrderUrgency = 'admission' | 'routine' | 'stat';

/**
 * `SILENCE[urgency]` in minutes — specs/engine.md §2.1, all `[assumed]`.
 * These live in the `settings` table ("engine/UI READ these, never hardcode").
 * They are exported as DEFAULTS only, to be passed in as a parameter.
 */
export const SILENCE_MINUTES_DEFAULT: Record<OrderUrgency, number> = {
  stat: 30,
  admission: 120,
  routine: 480,
};

export type LadderStep = 1 | 2 | 3 | 4 | 5;

export const LADDER_STEPS = [1, 2, 3, 4, 5] as const satisfies readonly LadderStep[];

/** Trigger = multiplier × SILENCE[urgency], measured from `vendor_notified`. */
export const LADDER_MULTIPLIERS: Record<LadderStep, number> = {
  1: 0.5,
  2: 1.0,
  3: 1.5,
  4: 2.0,
  5: 2.5,
};

export type LadderRecipient =
  | 'vendor_dispatch'
  | 'vendor_backup_contact'
  | 'nurse'
  | 'don'; // step 4 only, and only when the order is high-cost

/** Events a step is expected to produce. Named from the pinned EventType union. */
export type LadderEmission = 'message_sent' | 'at_risk_flagged' | 'escalated' | 'reordered';

/** Minimal structural view of an `order_events` row. Only these fields are read. */
export type LadderEvent = {
  /** Pinned EventType string. Unrecognised values are ignored, not errors. */
  type: string;
  /** ISO timestamp (order_events.created_at). */
  created_at: string;
  payload?: unknown;
};

export type LadderStepPlan = {
  step: LadderStep;
  multiplier: number;
  /** When this step became due. */
  dueAtIso: string;
  overdueByMinutes: number;
  recipients: LadderRecipient[];
  /**
   * Template to render, or null when the step is not an outbound vendor message
   * (steps 4 and 5 are internal). Merge `vars` with the caller's order vars.
   */
  template: TemplateId | null;
  vars: TemplateVars;
  channel: 'sms' | 'email' | 'in_app';
  /** Payload the caller must attach so this step is never re-fired. */
  marker: { kind: 'nudge'; ladder_step: LadderStep };
  emits: LadderEmission[];
  /**
   * true = a human must tap before ANY event is written for this step.
   * Step 5 surfaces a backup-vendor offer; §2.3 is explicit that
   * `vendor_declined` does not auto-reorder and nothing auto-cancels.
   */
  requiresHumanConfirm: boolean;
  /** Only meaningful when requiresHumanConfirm — what the human's tap produces. */
  emitsOnHumanConfirm: LadderEmission[];
  /** One plain sentence for the timeline / nurse banner. */
  summary: string;
};

export type LadderState = {
  /** false = ladder is not running (never notified, or a stop event landed). */
  active: boolean;
  /** ISO of the LATEST `vendor_notified`. A re-notify restarts the ladder. */
  notifiedAtIso: string | null;
  /** Event type that stopped the ladder (vendor answered / order moved on). */
  stoppedBy: string | null;
  silenceMinutes: number;
  /** Steps due now and not yet fired, ascending. Emit them in this order. */
  due: LadderStepPlan[];
  /** Steps already marked in the log (since the latest vendor_notified). */
  fired: LadderStep[];
  /** The next step that has not yet come due, with its trigger time. */
  next: { step: LadderStep; dueAtIso: string } | null;
};

export type LadderInput = {
  urgency: OrderUrgency;
  events: readonly LadderEvent[];
  /** Virtual now from src/lib/clock.ts. Never Date.now(). */
  now: Date | string;
  /** From the `settings` table. Falls back to SILENCE_MINUTES_DEFAULT per key. */
  silenceMinutes?: Partial<Record<OrderUrgency, number>>;
  /** Gates the DON on step 4 ("DON if high-cost"). Caller/rules.ts decides. */
  isHighCost?: boolean;
  /** Display name for the backup supplier in the step-5 offer text. */
  backupVendorName?: string;
  /** Display name of the notified vendor, for step summaries. */
  vendorName?: string;
};

/**
 * Any of these, occurring at or after the latest `vendor_notified`, stops the
 * ladder. The vendor answered, or the order moved past the point of nudging.
 * `vendor_declined` hands off to the §2.3 backup offer, which is the caller's
 * flow, not another rung.
 */
export const LADDER_STOP_EVENTS = [
  'vendor_confirmed',
  'vendor_declined',
  'dispatched',
  'delivered',
  'pickup_scheduled',
  'picked_up',
  'reordered',
  'denied',
] as const;

const STOP_SET: ReadonlySet<string> = new Set<string>(LADDER_STOP_EVENTS);

const MINUTE_MS = 60_000;

function toMs(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`nudge-ladder: unparseable timestamp "${String(value)}"`);
  return ms;
}

function payloadOf(e: LadderEvent): Record<string, unknown> | null {
  return typeof e.payload === 'object' && e.payload !== null
    ? (e.payload as Record<string, unknown>)
    : null;
}

/**
 * The step marker. Uniform rule: an event whose `payload.ladder_step` is this
 * step, and — when the event is a `message_sent` — whose `payload.kind` is
 * 'nudge' (amendment 9). Step 4 sends no vendor SMS, so its marker rides the
 * `escalated` event it already emits; accepting the marker on any event type
 * keeps one dedupe rule for the whole ladder instead of five special cases.
 */
function markerStep(e: LadderEvent): LadderStep | null {
  const p = payloadOf(e);
  if (!p) return null;
  const raw = p.ladder_step;
  const step = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!isLadderStep(step)) return null;
  if (e.type === 'message_sent' && p.kind !== 'nudge') return null;
  return step;
}

export function isLadderStep(n: number): n is LadderStep {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

function humanMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d} d` : `${d} d ${remH} hr`;
}

function buildPlan(
  step: LadderStep,
  dueAtMs: number,
  nowMs: number,
  input: LadderInput,
): LadderStepPlan {
  const overdueByMinutes = Math.round((nowMs - dueAtMs) / MINUTE_MS);
  const dueAtIso = new Date(dueAtMs).toISOString();
  const vendor = input.vendorName ?? 'the vendor';
  const backup = input.backupVendorName ?? 'another supplier';

  const base = {
    step,
    multiplier: LADDER_MULTIPLIERS[step],
    dueAtIso,
    overdueByMinutes,
    marker: { kind: 'nudge' as const, ladder_step: step },
  };

  switch (step) {
    case 1:
      return {
        ...base,
        recipients: ['vendor_dispatch'],
        template: 'vendor_nudge',
        vars: { ladder_step: '1' },
        channel: 'sms',
        emits: ['message_sent'],
        requiresHumanConfirm: false,
        emitsOnHumanConfirm: [],
        summary: `Friendly reminder sent to ${vendor}. Still no confirmation.`,
      };
    case 2:
      return {
        ...base,
        recipients: ['vendor_dispatch'],
        template: 'vendor_nudge',
        vars: { ladder_step: '2' },
        channel: 'sms',
        emits: ['message_sent', 'at_risk_flagged'],
        requiresHumanConfirm: false,
        emitsOnHumanConfirm: [],
        summary: `Deadline named to ${vendor}, asked for YES or a time. Order flagged amber.`,
      };
    case 3:
      return {
        ...base,
        recipients: ['vendor_dispatch', 'vendor_backup_contact'],
        template: 'vendor_nudge',
        vars: { ladder_step: '3' },
        channel: 'sms',
        emits: ['message_sent'],
        requiresHumanConfirm: false,
        emitsOnHumanConfirm: [],
        summary: `Hard deadline sent to ${vendor} and their backup contact.`,
      };
    case 4:
      return {
        ...base,
        recipients: input.isHighCost ? ['nurse', 'don'] : ['nurse'],
        template: null,
        vars: {},
        channel: 'in_app',
        emits: ['at_risk_flagged', 'escalated'],
        requiresHumanConfirm: false,
        emitsOnHumanConfirm: [],
        summary: input.isHighCost
          ? `No answer from ${vendor}. Nurse alerted and escalated to the DON (high-cost order).`
          : `No answer from ${vendor}. Nurse alerted.`,
      };
    case 5:
      return {
        ...base,
        recipients: ['nurse'],
        template: null,
        vars: {},
        channel: 'in_app',
        emits: [],
        requiresHumanConfirm: true,
        emitsOnHumanConfirm: ['message_sent', 'reordered'],
        summary:
          `Still nothing from ${vendor}. ${backup} can take this. ` +
          `Tap to send it over. Nothing is cancelled until you do.`,
      };
  }
}

/**
 * Derive ladder state from the event log. Returns which steps are DUE now and
 * unfired; the caller emits. Calling this twice with the same inputs returns the
 * same answer, and calling it after a big clock jump returns every step the
 * jump skipped past — which is precisely why the log comes out identical
 * regardless of how the clock got there.
 */
export function deriveLadderState(input: LadderInput): LadderState {
  const nowMs = toMs(input.now);
  const silenceMinutes =
    input.silenceMinutes?.[input.urgency] ?? SILENCE_MINUTES_DEFAULT[input.urgency];
  const silenceMs = silenceMinutes * MINUTE_MS;

  const events = [...input.events].sort((a, b) => toMs(a.created_at) - toMs(b.created_at));

  let notifiedAtMs: number | null = null;
  for (const e of events) {
    if (e.type === 'vendor_notified') notifiedAtMs = toMs(e.created_at);
  }

  const idle: LadderState = {
    active: false,
    notifiedAtIso: notifiedAtMs === null ? null : new Date(notifiedAtMs).toISOString(),
    stoppedBy: null,
    silenceMinutes,
    due: [],
    fired: [],
    next: null,
  };

  if (notifiedAtMs === null) return idle;

  const sinceNotify = events.filter((e) => toMs(e.created_at) >= notifiedAtMs);

  const stopper = sinceNotify.find((e) => e.type !== 'vendor_notified' && STOP_SET.has(e.type));
  const fired: LadderStep[] = [];
  for (const e of sinceNotify) {
    const step = markerStep(e);
    if (step !== null && !fired.includes(step)) fired.push(step);
  }
  fired.sort((a, b) => a - b);

  if (stopper) {
    return { ...idle, stoppedBy: stopper.type, fired };
  }

  const due: LadderStepPlan[] = [];
  let next: { step: LadderStep; dueAtIso: string } | null = null;

  for (const step of LADDER_STEPS) {
    const dueAtMs = notifiedAtMs + LADDER_MULTIPLIERS[step] * silenceMs;
    if (nowMs >= dueAtMs) {
      if (!fired.includes(step)) due.push(buildPlan(step, dueAtMs, nowMs, input));
    } else if (next === null) {
      next = { step, dueAtIso: new Date(dueAtMs).toISOString() };
    }
  }

  return {
    active: true,
    notifiedAtIso: new Date(notifiedAtMs).toISOString(),
    stoppedBy: null,
    silenceMinutes,
    due,
    fired,
    next,
  };
}

/**
 * Vars every vendor_nudge render needs on top of the order's own vars. `time_left`
 * is required by step 3's copy; compute it here so the caller cannot forget.
 * `neededBy` is the order's `target_at` (amendment 4).
 */
export function nudgeTimeVars(neededBy: Date | string, now: Date | string): TemplateVars {
  const left = (toMs(neededBy) - toMs(now)) / MINUTE_MS;
  return { time_left: left <= 0 ? 'no time' : humanMinutes(left) };
}
