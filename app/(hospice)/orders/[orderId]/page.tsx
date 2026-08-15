import Link from "next/link";
import EmptyState from "@/components/empty-state";
import EventTimeline from "@/components/event-timeline";
import PollRefresh from "@/components/poll-refresh";
import RiskBanner from "@/components/risk-banner";
import StatusChip from "@/components/status-chip";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { formatDayTime, formatUsd, perDayCents, URGENCY_LABEL } from "@/src/lib/domain";
import EscalationSheet from "./escalation-sheet";
import OrderActions from "./order-actions";
import ParseConfirm from "./parse-confirm";
import RetryCard from "./retry-card";
import { loadOrderDetail, timeLeftLabel } from "./data";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const virtualNow = await now();
  const loaded = await loadOrderDetail(orderId, virtualNow);

  if (!loaded.ok) {
    return (
      <section>
        <h1 className="text-[22px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Order
        </h1>
        <div className="mt-4">
          {loaded.reason === "not-found" ? (
            <EmptyState
              message="We couldn't find that order."
              actionLabel="Go to today"
              actionHref="/today"
            />
          ) : (
            <RetryCard />
          )}
        </div>
      </section>
    );
  }

  const order = loaded.data;
  // Both badges come from derive.ts; on a pickup the pickup badge is the one that
  // tells a reader what is actually wrong, so it wins the single chip slot.
  const badge = order.isPickup
    ? order.badges.find((b) => b === "PICKUP_DELAYED") ?? order.badges[0]
    : order.badges[0];
  const closed = order.status === "delivered" || order.status === "picked_up";
  const timeLeft = timeLeftLabel(order.targetAt, virtualNow);
  const sheetOpen = firstValue(query.sheet) === "escalate";
  const headline = order.items.map((i) => (i.qty > 1 ? `${i.plainName} × ${i.qty}` : i.plainName)).join(", ");

  // A pickup has no "needed by" to count down to; what matters is how long the
  // equipment has been sitting in the home since the vendor was told.
  const daysSinceRequest =
    order.pickupRequestedAt && !Number.isNaN(Date.parse(order.pickupRequestedAt))
      ? Math.max(
          0,
          Math.round(
            (virtualNow.getTime() - Date.parse(order.pickupRequestedAt)) / 86_400_000,
          ),
        )
      : null;
  const pressureLine = order.isPickup
    ? daysSinceRequest !== null
      ? `Requested ${daysSinceRequest} ${daysSinceRequest === 1 ? "day" : "days"} ago.`
      : null
    : timeLeft;

  const riskReason =
    order.riskReason ??
    (badge === "PICKUP_DELAYED"
      ? "This equipment is still in the home and no pickup has been scheduled."
      : null);

  return (
    <section>
      <PollRefresh intervalMs={5000} />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          {order.orderNo} · {URGENCY_LABEL[order.urgency]}
        </p>
        <h1 className="mt-1 text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {headline || order.orderNo}
        </h1>
        <p className="mt-0.5 text-[14px]">
          <Link href={`/patients/${order.patientId}`} className="underline">
            {order.patientName}
          </Link>
          {order.vendorName ? ` · ${order.vendorName}` : ""}
        </p>
        <div className="mt-2">
          <StatusChip status={order.status} badge={badge} awaitingApproval={order.awaiting} />
        </div>
        <p className="mt-2 text-[13.5px] text-[var(--ink-soft)]">
          {/* A needed-by weekday with no date reads as next week once the order is
              closed, so it only shows while it still means something. */}
          {closed || order.isPickup
            ? ""
            : order.targetAt
              ? `Needed by ${formatDayTime(order.targetAt)}. `
              : "No needed-by time set. "}
          {order.priceCents !== null ? `${formatUsd(perDayCents(order.priceCents))}/day.` : ""}
        </p>
        {order.priceCents !== null ? (
          <p className="mt-0.5">
            <AssumedLabel>Daily rate estimated as the monthly rental ÷ 30</AssumedLabel>
          </p>
        ) : null}
      </header>

      {badge && riskReason ? (
        <div className="mt-4">
          <RiskBanner
            title={badge === "PICKUP_DELAYED" ? "Pickup delayed" : "At risk"}
            reason={riskReason}
            timeLeft={pressureLine ?? undefined}
            actionLabel="See options"
            actionHref={`/orders/${order.id}?sheet=escalate`}
            updatedJustNow={order.justWentAmber}
          />
        </div>
      ) : null}

      {order.awaiting ? (
        <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3 text-[13.5px]">
          Waiting on the Director of Nursing. The vendor has not been contacted yet.
        </p>
      ) : null}

      <div className="mt-4">
        <OrderActions orderId={order.id} vendorPhone={order.vendorPhone} closed={closed} />
      </div>

      <div className="mt-6">
        <h2 className="text-[16px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          What has happened
        </h2>
        <div className="mt-3">
          <EventTimeline
            events={order.timeline}
            highlightId={order.justWentAmber ? order.highlightId : undefined}
            parsedAction={(event) =>
              order.pendingParse && event.message?.body === order.pendingParse.body ? (
                <ParseConfirm
                  orderId={order.id}
                  messageId={order.pendingParse.messageId}
                  intent={order.pendingParse.intent}
                  vendorPhone={order.vendorPhone}
                />
              ) : null
            }
          />
        </div>
      </div>

      <p className="mt-6 text-center">
        {order.source === "fixture" ? (
          <SyntheticLabel>Sample order — not connected to the database</SyntheticLabel>
        ) : (
          <SyntheticLabel />
        )}
      </p>

      {sheetOpen ? (
        <EscalationSheet
          orderId={order.id}
          reason={riskReason ?? "This order is not flagged right now."}
          timeLeft={pressureLine}
          vendorName={order.vendorName}
          vendorPhone={order.vendorPhone}
          backups={order.backups}
          isPickup={order.isPickup}
          cleared={!badge}
        />
      ) : null}
    </section>
  );
}
