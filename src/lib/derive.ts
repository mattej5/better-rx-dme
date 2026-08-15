// T3 — pure derivations over order_events rows. No I/O, no ambient clock.
// deriveStatus lives in events.ts; do not re-implement it here.
// Score formulas + constants: specs/data.md §3, variables: wiki/facts/vendor-scoring.md.
// Every constant below is [assumed] — no published DME SLA exists — and is a parameter
// with a default so a hospice can retune it without touching this file.

import type { Badge } from "@/src/lib/domain";
import { SETTING_DEFAULTS } from "@/src/lib/settings-defaults";

/** Structural shape satisfied by a Supabase `order_events` Row. */
export type DerivableEvent = {
  type: string;
  created_at?: string;
  order_id?: string;
  payload?: unknown;
};

export type ScoreBreakdown = {
  /** Stable machine key (spec name). */
  key: string;
  /** Back-compat alias of `key` — original stub field name. */
  variable: string;
  /** Human label the report card prints. */
  label: string;
  /** 0–100 subscore, or null when there is nothing to measure yet. */
  value: number | null;
  weight: number;
  /** Sample size behind `value` — printed so the formula is auditable. */
  n: number;
};

export type ScoreResult = {
  score: number | null;
  label: string;
  n_orders: number;
  breakdown: ScoreBreakdown[];
  synthetic: true;
};

export const MIN_ORDERS_FOR_SCORE = 5;

export const RELIABILITY_WEIGHTS = {
  on_time: 0.35,
  pickup_timeliness: 0.2,
  confirmation: 0.15,
  at_risk_freq: 0.15,
  eta_accuracy: 0.1,
  decline_behavior: 0.05,
} as const;

export const CONDITION_WEIGHTS = {
  functional: 0.3,
  clean: 0.25,
  repair: 0.2,
  defect_swap: 0.15,
  post_delivery_issues: 0.1,
} as const;

export const SCORE_DEFAULTS = {
  // Own constant, not derived from settings.pickup_amber_h — the fairness cutoff for
  // "batched pickup inside the window" is a scoring rule, not a tunable UI badge
  // threshold, even though both happen to be 24h today (data.md §257 / PICKUP_GREEN_H).
  pickupGreenH: 24,
  pickupRedH: 72,
  confirmFastMin: 15,
  confirmSlowMin: 240,
  etaZeroErrMin: 180,
  earlyDeclineMin: 60,
  earlyDeclineWeight: 0.25,
  minOrders: MIN_ORDERS_FOR_SCORE,
} as const;

export type ScoreOptions = Partial<typeof SCORE_DEFAULTS> & {
  /** Reference clock for open pickups. Omit and open pickups are not aged. */
  now?: Date;
};

export type BadgeOptions = {
  now?: Date;
  pickupAmberH?: number;
  pickupRedH?: number;
};

type Payload = Record<string, unknown>;

function payload(e: DerivableEvent | undefined): Payload {
  return e?.payload && typeof e.payload === "object" ? (e.payload as Payload) : {};
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const ms = (iso: string) => Date.parse(iso);
const minsBetween = (a: string, b: string) => (ms(b) - ms(a)) / 60_000;

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pct<T>(xs: T[], ok: (x: T) => boolean): number | null {
  return xs.length ? (100 * xs.filter(ok).length) / xs.length : null;
}

type OrderChain = DerivableEvent[];

/** Fairness: an event whose dispute the vendor won drops out of scoring entirely. */
function scored(e: DerivableEvent): boolean {
  return payload(e).dispute_upheld !== true;
}

function chronological(a: DerivableEvent, b: DerivableEvent): number {
  return ms(a.created_at ?? "") - ms(b.created_at ?? "");
}

/** Split a flat vendor-wide event list into per-order chains, each sorted in time. */
export function groupByOrder(events: DerivableEvent[]): OrderChain[] {
  const byOrder = new Map<string, OrderChain>();
  for (const e of events) {
    const key = e.order_id ?? "__no_order__";
    const chain = byOrder.get(key);
    if (chain) chain.push(e);
    else byOrder.set(key, [e]);
  }
  return [...byOrder.values()].map((chain) =>
    chain.every((e) => e.created_at) ? [...chain].sort(chronological) : chain,
  );
}

function first(o: OrderChain, type: string): DerivableEvent | undefined {
  return o.find((e) => e.type === type);
}

function last(o: OrderChain, type: string): DerivableEvent | undefined {
  for (let i = o.length - 1; i >= 0; i -= 1) if (o[i].type === type) return o[i];
  return undefined;
}

const has = (o: OrderChain, type: string) => first(o, type) !== undefined;

function at(o: OrderChain, type: string): string | null {
  return first(o, type)?.created_at ?? null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Latest ETA the vendor committed to: last eta_updated, else the confirm's promised_eta. */
function promisedEta(o: OrderChain): string | null {
  return (
    str(payload(last(o, "eta_updated")).eta) ??
    str(payload(first(o, "vendor_confirmed")).promised_eta)
  );
}

/**
 * The hospice's actual deadline: order_placed.payload.target_at (data.md §1.4/§4),
 * falling back to the vendor's promised ETA when a target was never set. on_time
 * scores against this; eta_accuracy stays vs promisedEta so a chronically-optimistic
 * vendor can still hit its target window while getting caught for sloppy ETAs.
 */
function targetAt(o: OrderChain): string | null {
  return str(payload(first(o, "order_placed")).target_at) ?? promisedEta(o);
}

function combine(parts: ScoreBreakdown[], n: number, minOrders: number): ScoreResult {
  if (n < minOrders) {
    return { score: null, label: "Unrated", n_orders: n, breakdown: parts, synthetic: true };
  }
  const live = parts.filter((p) => p.value !== null);
  const wsum = live.reduce((s, p) => s + p.weight, 0);
  if (wsum === 0) {
    return { score: null, label: "Unrated", n_orders: n, breakdown: parts, synthetic: true };
  }
  const score = Math.round(live.reduce((s, p) => s + (p.value as number) * p.weight, 0) / wsum);
  return { score, label: `${score}`, n_orders: n, breakdown: parts, synthetic: true };
}

function row(
  key: string,
  label: string,
  value: number | null,
  weight: number,
  n: number,
): ScoreBreakdown {
  return { key, variable: key, label, value: value === null ? null : Math.round(value), weight, n };
}

/**
 * Reliability — did it happen on time? Six variables per wiki/facts/vendor-scoring.md.
 * Input is every order_events row belonging to one vendor's orders (see reports/data.ts).
 */
export function reliabilityScore(events: DerivableEvent[], opts: ScoreOptions = {}): ScoreResult {
  const cfg = { ...SCORE_DEFAULTS, ...opts };
  const orders = groupByOrder(events.filter(scored));
  const n = orders.length;

  const withTarget = orders.filter((o) => has(o, "delivered") && targetAt(o) !== null);
  const onTime = pct(withTarget, (o) => ms(at(o, "delivered") as string) <= ms(targetAt(o) as string));

  const withEta = orders.filter((o) => has(o, "delivered") && promisedEta(o) !== null);
  const errs = withEta.map((o) =>
    Math.abs(minsBetween(promisedEta(o) as string, at(o, "delivered") as string)),
  );
  const etaAcc = errs.length ? clamp(100 - mean(errs) * (100 / cfg.etaZeroErrMin)) : null;

  const responses = orders
    .map((o) => {
      const notified = at(o, "vendor_notified");
      const confirmed = at(o, "vendor_confirmed");
      return notified && confirmed ? minsBetween(notified, confirmed) : null;
    })
    .filter((x): x is number => x !== null);
  const confirm = responses.length
    ? clamp(
        100 -
          ((median(responses) - cfg.confirmFastMin) * 100) /
            (cfg.confirmSlowMin - cfg.confirmFastMin),
      )
    : null;

  const atRisk = n
    ? clamp(100 - (100 * orders.filter((o) => has(o, "at_risk_flagged")).length) / n)
    : null;

  const pickups = orders.filter((o) => has(o, "pickup_requested"));
  const pickupScores = pickups
    .map((o) => {
      const requested = at(o, "pickup_requested") as string;
      const pickedUp = at(o, "picked_up");
      const batched = payload(first(o, "pickup_scheduled")).batched === true;
      if (!pickedUp) {
        if (!opts.now) return null;
        const openH = (opts.now.getTime() - ms(requested)) / 3_600_000;
        return openH <= cfg.pickupGreenH ? 100 : 0;
      }
      const h = minsBetween(requested, pickedUp) / 60;
      // Fairness [assumed]: a scheduled batched run collected inside the green window is
      // efficient routing, not a service failure, so it does not ding. Batching does not
      // forgive a late pickup all the way out to the red line (data.md §257).
      if (batched && h <= cfg.pickupGreenH) return 100;
      return clamp(100 - ((h - cfg.pickupGreenH) * 100) / (cfg.pickupRedH - cfg.pickupGreenH));
    })
    .filter((x): x is number => x !== null);
  const pickup = pickupScores.length ? mean(pickupScores) : null;

  // Fairness: an honest early decline dings a quarter of what a late one does.
  const declineLoad = orders.reduce((s, o) => {
    const d = first(o, "vendor_declined");
    if (!d) return s;
    const minutes = Number(payload(d).minutes_since_notified);
    const early = Number.isFinite(minutes) && minutes <= cfg.earlyDeclineMin;
    return s + (early ? cfg.earlyDeclineWeight : 1);
  }, 0);
  const decline = n ? clamp(100 - (100 * declineLoad) / n) : null;

  return combine(
    [
      row("on_time", "On-time delivery", onTime, RELIABILITY_WEIGHTS.on_time, withTarget.length),
      row("pickup_timeliness", "Pickup timeliness", pickup, RELIABILITY_WEIGHTS.pickup_timeliness, pickupScores.length),
      row("confirmation", "Answers the text", confirm, RELIABILITY_WEIGHTS.confirmation, responses.length),
      row("at_risk_freq", "Orders that went at-risk", atRisk, RELIABILITY_WEIGHTS.at_risk_freq, n),
      row("eta_accuracy", "ETA accuracy", etaAcc, RELIABILITY_WEIGHTS.eta_accuracy, errs.length),
      row("decline_behavior", "Decline behavior", decline, RELIABILITY_WEIGHTS.decline_behavior, n),
    ],
    n,
    cfg.minOrders,
  );
}

/** Condition — what showed up? Five variables per wiki/facts/vendor-scoring.md. */
export function conditionScore(events: DerivableEvent[], opts: ScoreOptions = {}): ScoreResult {
  const cfg = { ...SCORE_DEFAULTS, ...opts };
  const orders = groupByOrder(events.filter(scored));
  const reports = orders.flatMap((o) => o.filter((e) => e.type === "condition_reported"));
  const atDelivery = reports.filter((r) => payload(r).phase === "delivery");
  const after = reports.filter((r) => payload(r).phase === "post_delivery");
  const n = orders.filter((o) => has(o, "delivered")).length;

  const functional = pct(atDelivery, (r) => payload(r).functional === true);
  const clean = pct(atDelivery, (r) => payload(r).clean === true);
  const REPAIR: Record<string, number> = { good: 100, worn: 60, poor: 0 };
  const repair = atDelivery.length
    ? mean(atDelivery.map((r) => REPAIR[String(payload(r).repair)] ?? 60))
    : null;
  const issues = n
    ? clamp(100 - (100 * after.filter((r) => payload(r).issue !== "none").length) / n)
    : null;
  const swaps = n
    ? clamp(
        100 -
          (100 *
            orders.filter((o) => payload(first(o, "reordered")).reason === "defect").length) /
            n,
      )
    : null;

  return combine(
    [
      row("functional", "Worked on arrival", functional, CONDITION_WEIGHTS.functional, atDelivery.length),
      row("clean", "Clean / sanitized", clean, CONDITION_WEIGHTS.clean, atDelivery.length),
      row("repair", "State of repair", repair, CONDITION_WEIGHTS.repair, atDelivery.length),
      row("defect_swap", "Defect swap rate", swaps, CONDITION_WEIGHTS.defect_swap, n),
      row("post_delivery_issues", "Problems found later", issues, CONDITION_WEIGHTS.post_delivery_issues, n),
    ],
    n,
    cfg.minOrders,
  );
}

/**
 * Badges for ONE order's event chain. AT_RISK sorts first.
 * PICKUP_DELAYED needs a reference clock: pass `now` (the virtual demo clock)
 * or the pickup age cannot be computed and the badge is withheld.
 */
export function deriveBadges(events: DerivableEvent[], opts: BadgeOptions = {}): Badge[] {
  const badges: Badge[] = [];
  const chain = events.every((e) => e.created_at) ? [...events].sort(chronological) : events;

  const flagged = last(chain, "at_risk_flagged");
  const cleared = last(chain, "at_risk_cleared");
  const resolvedAt = Math.max(
    cleared ? ms(cleared.created_at ?? "") : -1,
    // Delivery/pickup resolves risk even without an explicit cleared event —
    // historical chains carry flags (scored by at_risk_freq) but are not live risks.
    ...chain
      .filter((e) => e.type === "delivered" || e.type === "picked_up")
      .map((e) => ms(e.created_at ?? "")),
  );
  if (flagged && resolvedAt < ms(flagged.created_at ?? "")) {
    badges.push("AT_RISK");
  }

  const requested = first(chain, "pickup_requested");
  if (opts.now && requested?.created_at && !has(chain, "picked_up")) {
    const amberH = opts.pickupAmberH ?? SETTING_DEFAULTS.pickup_amber_h;
    const openH = (opts.now.getTime() - ms(requested.created_at)) / 3_600_000;
    if (openH > amberH) badges.push("PICKUP_DELAYED");
  }

  return badges;
}

/** Newest at_risk_flagged reason on this order's chain, or null. */
export function atRiskReason(events: DerivableEvent[]): string | null {
  const chain = events.every((e) => e.created_at) ? [...events].sort(chronological) : events;
  return str(payload(last(chain, "at_risk_flagged")).reason);
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
