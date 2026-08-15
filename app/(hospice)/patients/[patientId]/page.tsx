import Link from "next/link";
import BigActionButton from "@/components/big-action-button";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import RiskBanner from "@/components/risk-banner";
import { SyntheticLabel } from "@/components/labels";
import { deriveBadges, awaitingApproval } from "@/src/lib/derive";
import { now } from "@/src/lib/clock";
import type { Badge, OrderStatus } from "@/src/lib/domain";
import EquipmentRow from "../equipment-row";
import RetryCard from "../retry-card";
import {
  daysSince,
  formatDate,
  loadPatientCard,
  orderItems,
  type OrderRow,
} from "../data";

export const dynamic = "force-dynamic";

type Line = {
  key: string;
  orderId: string;
  plainName: string;
  hcpcs: string;
  qty?: number;
  status: OrderStatus;
  badge?: Badge;
  awaiting: boolean;
  resupplyDue?: string;
  resupplyScheduleId?: string;
  pickupElapsedDays?: number;
};

function reasonOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const reason = (payload as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}

export default async function PatientCardPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const result = await loadPatientCard(patientId);
  const virtualNow = await now();

  if (!result.ok) {
    return (
      <section>
        <h1
          className="text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Patient
        </h1>
        <div className="mt-4">
          <RetryCard />
        </div>
      </section>
    );
  }

  const { patient, orders, events, resupply } = result.data;

  if (!patient) {
    return (
      <section>
        <h1
          className="text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Patient
        </h1>
        <div className="mt-4">
          <EmptyState
            message="We couldn't find that patient."
            actionLabel="All patients"
            actionHref="/patients"
          />
        </div>
      </section>
    );
  }

  const scheduleByHcpcs = new Map(resupply.map((r) => [r.hcpcs, r]));

  const lines: Line[] = [];
  const atRisk: { order: OrderRow; reason: string }[] = [];

  for (const order of orders) {
    const orderEvents = events.get(order.id) ?? [];
    const badge = deriveBadges(orderEvents, { now: virtualNow })[0];
    const awaiting = awaitingApproval(orderEvents);

    if (badge === "AT_RISK") {
      const flagged = [...orderEvents]
        .reverse()
        .find((e) => e.type === "at_risk_flagged");
      atRisk.push({
        order,
        reason:
          reasonOf(flagged?.payload) ??
          "This order is at risk of missing its needed-by time.",
      });
    }

    const pickupElapsedDays =
      badge === "PICKUP_DELAYED" && order.pickup_requested_at
        ? daysSince(order.pickup_requested_at, virtualNow)
        : undefined;

    for (const item of orderItems(order.items)) {
      const schedule = scheduleByHcpcs.get(item.hcpcs);
      lines.push({
        key: `${order.id}:${item.hcpcs}`,
        orderId: order.id,
        plainName: item.plain_name ?? item.hcpcs,
        hcpcs: item.hcpcs,
        qty: item.qty,
        status: order.status,
        badge,
        awaiting,
        resupplyDue: schedule ? formatDate(schedule.next_due_at) : undefined,
        resupplyScheduleId: schedule?.id,
        pickupElapsedDays,
      });
    }
  }

  return (
    <section>
      <PollRefresh intervalMs={5000} />

      <header>
        <h1
          className="text-[26px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          {patient.first_name} {patient.last_name}
        </h1>
        {patient.med_rec_no ? (
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
            MRN {patient.med_rec_no}
          </p>
        ) : null}
        <p className="mt-1">
          <SyntheticLabel>Synced from {patient.emr_source}</SyntheticLabel>
        </p>
      </header>

      {atRisk.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {atRisk.map(({ order, reason }) => (
            <RiskBanner
              key={order.id}
              reason={reason}
              actionLabel="See options"
              actionHref={`/orders/${order.id}?sheet=escalate`}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {lines.length === 0 ? (
          <EmptyState
            message="No equipment in this home yet."
            actionLabel="Order equipment"
            actionHref={`/patients/${patient.id}/order`}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.key}>
                <EquipmentRow
                  orderId={line.orderId}
                  plainName={line.plainName}
                  hcpcs={line.hcpcs}
                  qty={line.qty}
                  status={line.status}
                  badge={line.badge}
                  awaitingApproval={line.awaiting}
                  resupplyDue={line.resupplyDue}
                  resupplyScheduleId={line.resupplyScheduleId}
                  pickupElapsedDays={line.pickupElapsedDays}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <Link href={`/patients/${patient.id}/order`} className="block">
          <BigActionButton tone="primary" size="lg">
            ORDER EQUIPMENT
          </BigActionButton>
        </Link>
      </div>

      <div className="mt-8 border-t border-[var(--line)] pt-6">
        <Link href={`/patients/${patient.id}/status-change`} className="block">
          <BigActionButton tone="slate" size="xl">
            PATIENT STATUS CHANGE
          </BigActionButton>
        </Link>
      </div>

      <p className="mt-6 text-center">
        <SyntheticLabel />
      </p>
    </section>
  );
}
