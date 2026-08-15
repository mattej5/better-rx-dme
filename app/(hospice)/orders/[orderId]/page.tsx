import Link from "next/link";
import EmptyState from "@/components/empty-state";
import EventTimeline from "@/components/event-timeline";
import PollRefresh from "@/components/poll-refresh";
import RiskBanner from "@/components/risk-banner";
import StatusChip from "@/components/status-chip";
import { SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { atRiskReason, awaitingApproval, deriveBadges } from "@/src/lib/derive";
import { URGENCY_LABEL, formatUsd } from "@/src/lib/domain";
import RetryCard from "../../patients/retry-card";
import { orderItems } from "../../patients/data";
import {
  isPickupOrder,
  loadOrderDetail,
  timeLeftLabel,
  toTimeline,
} from "../data";
import EscalationSheet from "./escalation-sheet";
import ReplacementButton from "./replacement-button";

export const dynamic = "force-dynamic";

/** Spec 2.3: an at-risk flag under 10 minutes old is "just went amber". */
const AMBER_WINDOW_MS = 10 * 60 * 1000;

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[22px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
      {children}
    </h1>
  );
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ sheet?: string }>;
}) {
  const [{ orderId }, { sheet }, virtualNow] = await Promise.all([
    params,
    searchParams,
    now(),
  ]);
  const result = await loadOrderDetail(orderId);

  if (!result.ok) {
    return (
      <section>
        <Title>Order</Title>
        <div className="mt-4">
          <RetryCard />
        </div>
      </section>
    );
  }

  if (!result.data) {
    return (
      <section>
        <Title>Order</Title>
        <div className="mt-4">
          <EmptyState
            message="We couldn't find that order."
            actionLabel="All patients"
            actionHref="/patients"
          />
        </div>
      </section>
    );
  }

  const { order, patient, vendorName, events, messages, backup, replacesOrder, replacedByOrder } =
    result.data;

  const badge = deriveBadges(events, { now: virtualNow })[0];
  const awaiting = awaitingApproval(events);
  const reason = atRiskReason(events);
  const items = orderItems(order.items);
  const pickup = isPickupOrder(order, events);
  // target_at is the delivery deadline (contracts amendment 4), so the countdown means
  // nothing once the equipment has arrived or the order has moved to pickup.
  const stillOnTheWay =
    order.status === "ordered" || order.status === "dispatched" || order.status === "in_transit";
  const timeLeft = stillOnTheWay ? timeLeftLabel(order.target_at, virtualNow) : null;

  const lastFlag = [...events].reverse().find((e) => e.type === "at_risk_flagged");
  const justFlagged =
    badge === "AT_RISK" &&
    Boolean(lastFlag) &&
    virtualNow.getTime() - Date.parse(lastFlag!.created_at) <= AMBER_WINDOW_MS;
  const trigger = justFlagged
    ? [...events].reverse().find((e) => e.type === "patient_status_changed")
    : undefined;

  // N11 entry point. Only a delivered order with an unresolved condition issue can
  // be replaced; once a replacement exists the link above says so instead.
  const conditionIssue = [...events]
    .reverse()
    .find((event) => {
      if (event.type !== "condition_reported") return false;
      const payload = event.payload as Record<string, unknown> | null;
      const issue = typeof payload?.issue === "string" ? payload.issue : null;
      return Boolean(issue) && issue !== "none";
    });
  const replaceable =
    order.status === "delivered" && Boolean(conditionIssue) && !replacedByOrder;
  const issueLabel =
    (conditionIssue?.payload as Record<string, unknown> | null)?.issue === "dirty"
      ? "dirty"
      : (conditionIssue?.payload as Record<string, unknown> | null)?.issue === "damaged"
        ? "damaged"
        : "not working";

  const timeline = toTimeline(events, messages, vendorName, replacedByOrder?.orderNo ?? null);
  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";

  return (
    <section>
      <PollRefresh intervalMs={5000} />

      <header>
        {patient ? (
          <Link href={`/patients/${patient.id}`} className="text-[26px] leading-tight underline-offset-4 hover:underline">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{patientName}</span>
          </Link>
        ) : (
          <Title>{patientName}</Title>
        )}
        <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
          Order {order.order_no} · {URGENCY_LABEL[order.urgency]}
        </p>

        <ul className="mt-3 flex flex-col gap-1">
          {items.length === 0 ? (
            <li className="text-[15px] text-[var(--ink-soft)]">Equipment details unavailable</li>
          ) : (
            items.map((item) => (
              <li key={item.hcpcs}>
                <p className="text-[18px] font-semibold leading-tight">
                  {item.qty && item.qty > 1 ? `${item.qty} × ` : ""}
                  {item.plain_name ?? item.hcpcs}
                </p>
                <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                  {item.hcpcs}
                </p>
              </li>
            ))
          )}
        </ul>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold">{vendorName ?? "No vendor chosen yet"}</p>
            {order.price_cents !== null ? (
              <p className="text-[12px] text-[var(--ink-soft)]">
                {formatUsd(order.price_cents)}/month
              </p>
            ) : null}
          </div>
          <StatusChip status={order.status} badge={badge} awaitingApproval={awaiting} />
        </div>

        {replacesOrder ? (
          <p className="mt-2 text-[13px]">
            <Link href={`/orders/${replacesOrder.id}`} className="underline underline-offset-2">
              Replaces order {replacesOrder.orderNo}
            </Link>
          </p>
        ) : null}
        {replacedByOrder ? (
          <p className="mt-2 text-[13px]">
            <Link href={`/orders/${replacedByOrder.id}`} className="underline underline-offset-2">
              Replaced by order {replacedByOrder.orderNo}
            </Link>
          </p>
        ) : null}
      </header>

      {badge === "AT_RISK" ? (
        <div className="mt-4">
          <RiskBanner
            reason={reason ?? "This order is at risk of missing its needed-by time."}
            timeLeft={timeLeft ?? undefined}
            updatedJustNow={justFlagged}
            actionLabel="See options"
            actionHref={`/orders/${order.id}?sheet=escalate`}
          />
        </div>
      ) : null}

      {badge === "PICKUP_DELAYED" ? (
        <div className="mt-4">
          <RiskBanner
            title="Pickup delayed"
            reason={
              reason ?? "Pickup was requested and the equipment is still in the home."
            }
            actionLabel="See options"
            actionHref={`/orders/${order.id}?sheet=escalate`}
          />
        </div>
      ) : null}

      {replaceable ? (
        <ReplacementButton
          orderId={order.id}
          conditionEventId={conditionIssue?.id}
          issueLabel={issueLabel}
        />
      ) : null}

      <div className="mt-6">
        <h2
          className="text-[16px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          What has happened
        </h2>
        <div className="mt-3">
          <EventTimeline events={timeline} highlightId={trigger?.id} />
        </div>
      </div>

      <p className="mt-6 text-center">
        <SyntheticLabel />
      </p>

      {sheet === "escalate" ? (
        <EscalationSheet
          orderId={order.id}
          closeHref={`/orders/${order.id}`}
          reason={badge === "AT_RISK" ? (reason ?? "This order needs a decision.") : null}
          timeLeft={timeLeft}
          isPickup={pickup}
          backup={backup}
          currentPriceCents={order.price_cents}
        />
      ) : null}
    </section>
  );
}
