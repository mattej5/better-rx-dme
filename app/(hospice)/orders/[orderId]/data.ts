import "server-only";
import {
  atRiskReason,
  awaitingApproval,
  deriveBadges,
  reliabilityScore,
  type DerivableEvent,
} from "@/src/lib/derive";
import {
  canActOnParse,
  parseWithRegex,
  type OrderContext,
  type ParseResult,
} from "@/src/lib/parse-vendor-reply";
import {
  formatTime,
  formatUsd,
  perDayCents,
  type Badge,
  type OrderStatus,
  type OrderUrgency,
  type TimelineEvent,
  URGENCY_LABEL,
} from "@/src/lib/domain";
import { hasSupabaseEnv } from "../../patients/data";
import { loadSettings } from "../../settings/data";
import {
  FIXTURE_PATIENTS,
  FIXTURE_VENDORS,
  fixtureOrders,
  fixturePrice,
  fixtureVendorEvents,
  type FixtureMessage,
} from "../../order/fixtures";

/** specs/frontend.md 2.3 — "just went amber" is a 10-minute window. */
export const AMBER_WINDOW_MS = 10 * 60 * 1000;

export type OrderItemLine = { hcpcs: string; plainName: string; qty: number };

export type BackupOption = {
  vendorId: string;
  name: string;
  monthlyCents: number;
  /** Per-day difference against what this order costs today. Positive = costs more. */
  perDayDeltaCents: number;
  etaIso: string;
  meetsDeadline: boolean;
  reliability: number | "unrated";
};

export type PendingParse = {
  messageId: string;
  body: string;
  /** Plain-words reading, e.g. "running late, now arriving 5:10 PM". */
  line: string;
  confidence: number;
  intent: string;
  method: string;
  /** canActOnParse() — false means nothing changes until a nurse taps confirm. */
  canAct: boolean;
};

export type OrderDetail = {
  source: "database" | "fixture";
  id: string;
  orderNo: string;
  status: OrderStatus;
  urgency: OrderUrgency;
  items: OrderItemLine[];
  priceCents: number | null;
  targetAt: string | null;
  orderedAt: string;
  pickupRequestedAt: string | null;
  patientId: string;
  patientName: string;
  vendorId: string | null;
  vendorName: string | null;
  vendorPhone: string | null;
  /** Pickups can never reroute to a backup vendor (engine addendum #7). */
  isPickup: boolean;
  timeline: TimelineEvent[];
  badges: Badge[];
  awaiting: boolean;
  riskReason: string | null;
  riskFlaggedAt: string | null;
  justWentAmber: boolean;
  /** The row that caused the flag — highlighted so the causal link is visible. */
  highlightId?: string | number;
  backups: BackupOption[];
  pendingParse: PendingParse | null;
};

export type OrderDetailLoaded =
  | { ok: true; data: OrderDetail }
  | { ok: false; reason: "not-found" | "error" };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function itemLines(items: unknown): OrderItemLine[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const rec = record(raw);
    const hcpcs = text(rec.hcpcs);
    if (!hcpcs) return [];
    return [
      {
        hcpcs,
        plainName: text(rec.plain_name) ?? text(rec.plainName) ?? hcpcs,
        qty: typeof rec.qty === "number" ? rec.qty : 1,
      },
    ];
  });
}

function safeTime(iso: string | null): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  return formatTime(iso);
}

/** One plain sentence under an event row. Unknown types simply get none. */
function detailFor(event: DerivableEvent, vendorName: string | null): string | null {
  const p = record(event.payload);
  switch (event.type) {
    case "order_placed": {
      const urgency = text(p.urgency);
      const target = safeTime(text(p.target_at));
      const label = urgency && urgency in URGENCY_LABEL
        ? URGENCY_LABEL[urgency as OrderUrgency]
        : urgency;
      return [label ? `${label} order` : null, target ? `needed by ${target}` : null]
        .filter(Boolean)
        .join(" · ") || null;
    }
    case "approval_requested": {
      const price = typeof p.price_cents === "number" ? p.price_cents : null;
      const threshold = typeof p.threshold_cents === "number" ? p.threshold_cents : null;
      if (price === null || threshold === null) return "Waiting on the Director of Nursing.";
      return `${formatUsd(price)} is at or above the ${formatUsd(threshold)} approval threshold. The vendor has not been contacted.`;
    }
    case "approved":
      return text(p.reason) ?? "The vendor is being notified now.";
    case "denied":
      return text(p.reason);
    case "vendor_notified":
      return vendorName ? `Text sent to ${vendorName}.` : null;
    case "vendor_confirmed": {
      const eta = safeTime(text(p.promised_eta));
      return eta ? `Promised ${eta}.` : null;
    }
    case "vendor_declined":
      return text(p.reason);
    case "eta_updated": {
      const eta = safeTime(text(p.eta) ?? text(p.eta_iso));
      const source = text(p.source);
      return eta ? `Now expected ${eta}${source ? ` (${source})` : ""}.` : null;
    }
    case "at_risk_flagged":
    case "at_risk_cleared":
      return text(p.reason);
    case "escalated":
      return text(p.reason);
    case "reordered":
      return text(p.reason) ? `Reason: ${text(p.reason)}` : null;
    case "delivered": {
      const who = text(p.signature_name) ?? text(p.signature);
      return who ? `Signed for by ${who}.` : null;
    }
    case "condition_reported": {
      const issue = text(p.issue);
      const phase = text(p.phase) === "post_delivery" ? "Found later" : "At delivery";
      return issue ? `${phase}: ${issue === "none" ? "no problems" : issue}.` : null;
    }
    case "patient_status_changed": {
      const to = text(p.to) ?? text(p.status);
      return to ? `Patient marked ${to}.` : null;
    }
    case "pickup_requested":
      return "Vendor notified. The rental billing clock stops at this timestamp.";
    case "pickup_scheduled": {
      const start = safeTime(text(p.window_start));
      const end = safeTime(text(p.window_end));
      return start && end ? `Window ${start} to ${end}.` : null;
    }
    case "message_sent":
      return text(p.kind) === "nudge" ? "Follow-up reminder." : null;
    case "resupply_due":
      return "Time to reorder this supply.";
    default:
      return null;
  }
}

function parseLine(result: ParseResult): string {
  const eta = result.eta && !Number.isNaN(Date.parse(result.eta))
    ? formatTime(result.eta)
    : null;
  switch (result.intent) {
    case "confirm":
      return eta ? `they confirmed, arriving ${eta}` : "they confirmed the order";
    case "decline":
      return result.reason
        ? `they cannot take it: ${result.reason}`
        : "they cannot take this order";
    case "eta":
      return eta ? `arriving ${eta}` : "they gave a time";
    case "delay":
      return eta ? `running late, now arriving ${eta}` : "running late";
    case "question":
      return "they asked a question";
    default:
      return "we could not tell what this means";
  }
}

type MessageLike = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  who: string;
  created_at: string;
  parsed: Record<string, unknown> | null;
};

type BuildInput = {
  events: (DerivableEvent & { id?: string | number; actor?: string | null })[];
  messages: MessageLike[];
  vendorName: string | null;
  orderId: string;
  orderNo: string;
  urgency: OrderUrgency;
  targetAt: string | null;
  itemName: string;
  patientArea: string;
  now: Date;
};

function buildTimeline(input: BuildInput): {
  timeline: TimelineEvent[];
  pendingParse: PendingParse | null;
  highlightId?: string | number;
} {
  const byId = new Map(input.messages.map((m) => [m.id, m]));
  const sorted = [...input.events].sort(
    (a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""),
  );

  const orderContext: OrderContext = {
    orderId: input.orderId,
    item: input.itemName,
    patientArea: input.patientArea,
    neededBy: input.targetAt ?? new Date(input.now).toISOString(),
    urgency: input.urgency,
    vendorName: input.vendorName ?? "the vendor",
  };

  let pendingParse: PendingParse | null = null;
  const timeline: TimelineEvent[] = [];

  sorted.forEach((event, index) => {
    const id = event.id ?? `${event.type}-${index}`;
    const payload = record(event.payload);
    const messageId = text(payload.message_id);
    const message = messageId ? byId.get(messageId) : undefined;

    const row: TimelineEvent = {
      id,
      type: event.type,
      at: event.created_at ?? new Date(input.now).toISOString(),
      actor: event.actor ?? null,
      detail: detailFor(event, input.vendorName),
    };

    if (message) {
      row.message = {
        direction: message.direction,
        body: message.body,
        who: message.who,
      };

      if (message.direction === "inbound") {
        // Stored parse wins. Anything unparsed gets the deterministic pass here —
        // free, ~0.1ms, no network. The LLM half of parseVendorReply() belongs to
        // the inbound webhook, not to a page that re-renders on every poll.
        const stored = message.parsed;
        const storedIntent = stored ? text(stored.intent) : null;
        const storedConfidence =
          stored && typeof stored.confidence === "number" ? stored.confidence : null;

        const result: ParseResult =
          storedIntent && storedConfidence !== null
            ? {
                intent: storedIntent as ParseResult["intent"],
                confidence: storedConfidence,
                method: text(stored?.parser) === "llm" ? "llm" : "regex",
                ...(text(stored?.eta) ? { eta: text(stored?.eta) as string } : {}),
                ...(text(stored?.reason) ? { reason: text(stored?.reason) as string } : {}),
              }
            : parseWithRegex(message.body, orderContext);

        const line = parseLine(result);
        row.parsed = { line, confidence: result.confidence };

        // The safety gate, read from parse-vendor-reply.ts — never re-implemented.
        if (!canActOnParse(result) && !pendingParse) {
          pendingParse = {
            messageId: message.id,
            body: message.body,
            line,
            confidence: result.confidence,
            intent: result.intent,
            method: result.method,
            canAct: false,
          };
        }
      }
    }

    timeline.push(row);
  });

  // The causal row a judge should see: whatever immediately preceded the newest flag.
  let highlightId: string | number | undefined;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (timeline[i].type === "at_risk_flagged") {
      for (let j = i - 1; j >= 0; j -= 1) {
        const type = timeline[j].type;
        if (type === "patient_status_changed" || type === "eta_updated" || type === "message_received") {
          highlightId = timeline[j].id;
          break;
        }
      }
      break;
    }
  }

  return { timeline, pendingParse, highlightId };
}

function backupsFrom(
  candidates: {
    vendorId: string;
    name: string;
    monthlyCents: number;
    leadTimeHours: number;
    reliability: number | "unrated";
  }[],
  currentMonthlyCents: number | null,
  targetAt: string | null,
  now: Date,
): BackupOption[] {
  const targetMs = targetAt ? Date.parse(targetAt) : Number.POSITIVE_INFINITY;
  return candidates
    .map((c) => {
      const etaMs = now.getTime() + c.leadTimeHours * 3_600_000;
      return {
        vendorId: c.vendorId,
        name: c.name,
        monthlyCents: c.monthlyCents,
        perDayDeltaCents:
          perDayCents(c.monthlyCents) - perDayCents(currentMonthlyCents ?? c.monthlyCents),
        etaIso: new Date(etaMs).toISOString(),
        meetsDeadline: etaMs <= targetMs,
        reliability: c.reliability,
      };
    })
    .sort((a, b) => {
      if (a.meetsDeadline !== b.meetsDeadline) return a.meetsDeadline ? -1 : 1;
      const ar = a.reliability === "unrated" ? -1 : a.reliability;
      const br = b.reliability === "unrated" ? -1 : b.reliability;
      if (ar !== br) return br - ar;
      return a.monthlyCents - b.monthlyCents;
    })
    .slice(0, 3);
}

/** STUB pending SUPABASE_SERVICE_ROLE_KEY — app/(hospice)/order/fixtures.ts. */
function fixtureDetail(orderId: string, now: Date, pickupAmberH: number): OrderDetailLoaded {
  const orders = fixtureOrders(now);
  const found =
    orders.find((o) => o.id === orderId) ?? orders.find((o) => o.order_no === orderId);
  if (!found) return { ok: false, reason: "not-found" };

  const vendor = FIXTURE_VENDORS.find((v) => v.id === found.vendor_id) ?? null;
  const patient = FIXTURE_PATIENTS.find((p) => p.id === found.patient_id) ?? null;
  const items = found.items.map((i) => ({ hcpcs: i.hcpcs, plainName: i.plain_name, qty: i.qty }));
  const messages: MessageLike[] = found.messages.map((m: FixtureMessage) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    who: m.who,
    created_at: m.created_at,
    parsed: m.parsed as Record<string, unknown> | null,
  }));

  const { timeline, pendingParse, highlightId } = buildTimeline({
    events: found.events,
    messages,
    vendorName: vendor?.name ?? null,
    orderId: found.id,
    orderNo: found.order_no,
    urgency: found.urgency,
    targetAt: found.target_at,
    itemName: items[0]?.plainName ?? "equipment",
    patientArea: patient?.city ?? "Aurora",
    now,
  });

  const flagged = [...found.events]
    .filter((e) => e.type === "at_risk_flagged")
    .sort((a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""))
    .at(-1);

  const isPickup =
    found.status === "pickup_triggered" ||
    found.status === "picked_up" ||
    found.events.some((e) => e.type === "pickup_requested");

  const candidates = FIXTURE_VENDORS.filter((v) => v.id !== found.vendor_id).flatMap((v) => {
    const prices = items.map((i) => fixturePrice(v, i.hcpcs));
    if (prices.some((p) => p === null)) return [];
    const score = reliabilityScore(fixtureVendorEvents(v, now), { now });
    return [
      {
        vendorId: v.id,
        name: v.name,
        monthlyCents: prices.reduce((s, p, i) => s + (p?.price_cents ?? 0) * items[i].qty, 0),
        leadTimeHours: Math.max(...prices.map((p) => p?.lead_time_hours ?? 24)),
        reliability: (score.score === null ? "unrated" : score.score) as number | "unrated",
      },
    ];
  });

  return {
    ok: true,
    data: {
      source: "fixture",
      id: found.id,
      orderNo: found.order_no,
      status: found.status as OrderStatus,
      urgency: found.urgency,
      items,
      priceCents: found.price_cents,
      targetAt: found.target_at,
      orderedAt: found.ordered_at,
      pickupRequestedAt: found.pickup_requested_at,
      patientId: found.patient_id,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Patient",
      vendorId: found.vendor_id,
      vendorName: vendor?.name ?? null,
      vendorPhone: vendor?.dispatch_phone ?? null,
      isPickup,
      timeline,
      badges: deriveBadges(found.events, { now, pickupAmberH }),
      awaiting: awaitingApproval(found.events),
      riskReason: atRiskReason(found.events),
      riskFlaggedAt: flagged?.created_at ?? null,
      justWentAmber: flagged?.created_at
        ? now.getTime() - Date.parse(flagged.created_at) < AMBER_WINDOW_MS
        : false,
      highlightId,
      backups: isPickup
        ? []
        : backupsFrom(candidates, found.price_cents, found.target_at, now),
      pendingParse,
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadOrderDetail(
  orderId: string,
  now: Date,
): Promise<OrderDetailLoaded> {
  const settings = await loadSettings();
  const pickupAmberH = settings.values.pickup_amber_h;

  if (!hasSupabaseEnv()) return fixtureDetail(orderId, now, pickupAmberH);

  try {
    const { supabase } = await import("@/src/lib/supabase");

    // Demo links sometimes carry the human order number instead of the uuid.
    const orderRes = UUID_RE.test(orderId)
      ? await supabase.from("orders").select("*").eq("id", orderId).maybeSingle()
      : await supabase.from("orders").select("*").eq("order_no", orderId).maybeSingle();
    if (orderRes.error) return { ok: false, reason: "error" };
    if (!orderRes.data) return { ok: false, reason: "not-found" };
    const order = orderRes.data;

    const [eventsRes, messagesRes, patientRes, vendorRes] = await Promise.all([
      supabase.from("order_events").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
      supabase.from("messages").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
      supabase.from("patients").select("id,first_name,last_name,address").eq("id", order.patient_id).maybeSingle(),
      order.vendor_id
        ? supabase.from("vendors").select("id,name,dispatch_phone").eq("id", order.vendor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (eventsRes.error || messagesRes.error) return { ok: false, reason: "error" };

    const events = eventsRes.data ?? [];
    const items = itemLines(order.items);
    const vendorName = vendorRes.data?.name ?? null;
    const patientCity = text(record(patientRes.data?.address).city) ?? "the area";

    const messages: MessageLike[] = (messagesRes.data ?? []).map((m) => ({
      id: m.id,
      direction: m.direction === "inbound" ? "inbound" : "outbound",
      body: m.body,
      who:
        m.direction === "inbound"
          ? `${vendorName ?? "Vendor"} dispatch`
          : `To ${vendorName ?? "vendor"}`,
      created_at: m.created_at,
      parsed: record(m.parsed),
    }));
    // A message row with no parsed jsonb should fall through to the regex pass.
    for (const m of messages) {
      if (m.parsed && Object.keys(m.parsed).length === 0) m.parsed = null;
    }

    const { timeline, pendingParse, highlightId } = buildTimeline({
      events,
      messages,
      vendorName,
      orderId: order.id,
      orderNo: order.order_no,
      urgency: order.urgency,
      targetAt: order.target_at,
      itemName: items[0]?.plainName ?? "equipment",
      patientArea: patientCity,
      now,
    });

    const flagged = [...events].filter((e) => e.type === "at_risk_flagged").at(-1);
    const isPickup =
      order.status === "pickup_triggered" ||
      order.status === "picked_up" ||
      events.some((e) => e.type === "pickup_requested");

    let backups: BackupOption[] = [];
    if (!isPickup && items.length > 0) {
      const [pricesRes, vendorsRes, allOrdersRes] = await Promise.all([
        supabase.from("vendor_prices").select("*").in("hcpcs", items.map((i) => i.hcpcs)),
        supabase.from("vendors").select("id,name").neq("status", "paused"),
        supabase.from("orders").select("id,vendor_id"),
      ]);
      if (!pricesRes.error && !vendorsRes.error && !allOrdersRes.error) {
        const allOrders = allOrdersRes.data ?? [];
        const scoreEventsRes = allOrders.length
          ? await supabase.from("order_events").select("*").in("order_id", allOrders.map((o) => o.id))
          : { data: [], error: null };
        const byOrder = new Map<string, DerivableEvent[]>();
        for (const e of scoreEventsRes.data ?? []) {
          const list = byOrder.get(e.order_id) ?? [];
          list.push(e);
          byOrder.set(e.order_id, list);
        }

        const candidates = (vendorsRes.data ?? [])
          .filter((v) => v.id !== order.vendor_id)
          .flatMap((v) => {
            const priced = items.map((i) =>
              (pricesRes.data ?? []).find((p) => p.vendor_id === v.id && p.hcpcs === i.hcpcs),
            );
            if (priced.some((p) => !p)) return [];
            const vendorEvents = allOrders
              .filter((o) => o.vendor_id === v.id)
              .flatMap((o) => byOrder.get(o.id) ?? []);
            const score = reliabilityScore(vendorEvents, { now });
            return [
              {
                vendorId: v.id,
                name: v.name,
                monthlyCents: priced.reduce(
                  (s, p, i) => s + (p?.price_cents ?? 0) * items[i].qty,
                  0,
                ),
                leadTimeHours: Math.max(...priced.map((p) => p?.lead_time_hours ?? 24)),
                reliability: (score.score === null ? "unrated" : score.score) as
                  | number
                  | "unrated",
              },
            ];
          });
        backups = backupsFrom(candidates, order.price_cents, order.target_at, now);
      }
    }

    return {
      ok: true,
      data: {
        source: "database",
        id: order.id,
        orderNo: order.order_no,
        status: order.status,
        urgency: order.urgency,
        items,
        priceCents: order.price_cents,
        targetAt: order.target_at,
        orderedAt: order.ordered_at,
        pickupRequestedAt: order.pickup_requested_at,
        patientId: order.patient_id,
        patientName: patientRes.data
          ? `${patientRes.data.first_name} ${patientRes.data.last_name}`
          : "Patient",
        vendorId: order.vendor_id,
        vendorName,
        vendorPhone: vendorRes.data?.dispatch_phone ?? null,
        isPickup,
        timeline,
        badges: deriveBadges(events, { now, pickupAmberH }),
        awaiting: awaitingApproval(events),
        riskReason: atRiskReason(events),
        riskFlaggedAt: flagged?.created_at ?? null,
        justWentAmber: flagged?.created_at
          ? now.getTime() - Date.parse(flagged.created_at) < AMBER_WINDOW_MS
          : false,
        highlightId,
        backups,
        pendingParse,
      },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** "3 hours to fix" / "40 minutes to fix" — never a bare timestamp. */
export function timeLeftLabel(targetAt: string | null, now: Date): string | null {
  if (!targetAt || Number.isNaN(Date.parse(targetAt))) return null;
  const minutes = Math.round((Date.parse(targetAt) - now.getTime()) / 60_000);
  if (minutes <= 0) return "The needed-by time has passed.";
  if (minutes < 90) return `${minutes} minutes to fix it.`;
  const hours = Math.round(minutes / 60);
  return `${hours} hours to fix it.`;
}
