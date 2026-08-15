import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import RiskBanner from "@/components/risk-banner";
import StatusChip from "@/components/status-chip";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { awaitingApproval, deriveBadges } from "@/src/lib/derive";
import { formatDayTime, formatUsd, type Badge } from "@/src/lib/domain";
import { getSession, ROLE_FOCUS, type Role } from "@/src/lib/role";
import { orderItems, statusRank } from "../patients/data";
import OrderCard from "./order-card";
import RetryCard from "./retry-card";
import {
  hoursSince,
  isSameDay,
  loadToday,
  type OrderCard as OrderCardData,
  type PatientRow,
  type TodayData,
} from "./data";

export const dynamic = "force-dynamic";

const NEW_ADMISSION_HOURS = 48;

type Enriched = OrderCardData & {
  badge?: Badge;
  awaiting: boolean;
};

function enrich(data: TodayData, at: Date): Enriched[] {
  return data.cards.map((card) => ({
    ...card,
    badge: deriveBadges(card.events, { now: at })[0],
    awaiting: awaitingApproval(card.events),
  }));
}

function itemLine(card: OrderCardData): string {
  const items = orderItems(card.order.items);
  if (items.length === 0) return card.order.order_no;
  const names = items.map((i) => i.plain_name ?? i.hcpcs);
  return names.length > 2
    ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more`
    : names.join(", ");
}

function whenLine(card: OrderCardData): string | undefined {
  const at = card.order.current_eta ?? card.order.target_at;
  if (!at) return undefined;
  return card.order.current_eta
    ? `Arrives ${formatDayTime(at)}`
    : `Needed by ${formatDayTime(at)}`;
}

function Card({ card }: { card: Enriched }) {
  return (
    <OrderCard
      href={`/orders/${card.order.id}`}
      patientName={`${card.patient.first_name} ${card.patient.last_name}`}
      itemLine={itemLine(card)}
      whenLine={whenLine(card)}
      vendorName={card.vendorName}
      status={card.order.status}
      badge={card.badge}
      awaitingApproval={card.awaiting}
      reason={card.reason}
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2
        className="text-[15px] text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Renders nothing until derive.ts returns badges (T3) — no empty red section. */
function NeedsAttention({
  cards,
  amberCount,
  recentIds,
}: {
  cards: Enriched[];
  amberCount: number;
  recentIds: Set<string>;
}) {
  if (cards.length === 0) return null;
  const target = cards.find((c) => recentIds.has(c.order.id)) ?? cards[0];
  return (
    <Section title="Needs attention">
      {amberCount > 0 ? (
        <RiskBanner
          title="Dates moved earlier"
          reason={`A patient's status changed. ${amberCount} ${amberCount === 1 ? "order" : "orders"} just went at risk.`}
          actionLabel="Open order"
          actionHref={`/orders/${target.order.id}`}
          updatedJustNow
        />
      ) : null}
      {cards.map((card) => (
        <Card key={card.order.id} card={card} />
      ))}
    </Section>
  );
}

function PatientRowLink({
  patient,
  cards,
}: {
  patient: PatientRow;
  cards: Enriched[];
}) {
  const worst = [...cards].sort(
    (a, b) =>
      (a.badge ? -1 : statusRank(a.order.status)) -
      (b.badge ? -1 : statusRank(b.order.status)),
  )[0];
  return (
    <Link
      href={`/patients/${patient.id}`}
      className="block rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={worst.badge ? { borderColor: "var(--red)" } : undefined}
    >
      <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
        {patient.first_name} {patient.last_name}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
        {cards.length} open {cards.length === 1 ? "order" : "orders"}
      </p>
      <div className="mt-2">
        <StatusChip
          status={worst.order.status}
          badge={worst.badge}
          awaitingApproval={worst.awaiting}
        />
      </div>
    </Link>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p
        className="mt-1 text-[26px] leading-none text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {value}
      </p>
      {note ? <p className="mt-1">{note}</p> : null}
    </div>
  );
}

function NurseStack({ cards, patients, at }: StackProps) {
  const dueToday = cards.filter(
    (c) =>
      !c.badge &&
      c.order.target_at !== null &&
      isSameDay(c.order.target_at, at) &&
      c.order.status !== "delivered" &&
      c.order.status !== "pickup_triggered",
  );
  const newAdmissions = patients.filter(
    (p) => p.admitted_at && hoursSince(p.admitted_at, at) <= NEW_ADMISSION_HOURS,
  );

  return (
    <>
      <Section title="Due today">
        {dueToday.length === 0 ? (
          <EmptyState message="Nothing is due today." />
        ) : (
          dueToday.map((card) => <Card key={card.order.id} card={card} />)
        )}
      </Section>

      <Section title="New admissions">
        {newAdmissions.length === 0 ? (
          <EmptyState message="No admissions in the last two days." />
        ) : (
          newAdmissions.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="block rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
                {p.first_name} {p.last_name}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
                {p.admitted_at
                  ? `Admitted ${formatDayTime(p.admitted_at)}`
                  : "Admitted recently"}
              </p>
            </Link>
          ))
        )}
      </Section>
    </>
  );
}

function CaseManagerStack({ cards, patients }: StackProps) {
  const byPatient = new Map<string, Enriched[]>();
  for (const card of cards) {
    const list = byPatient.get(card.patient.id);
    if (list) list.push(card);
    else byPatient.set(card.patient.id, [card]);
  }
  const rows = patients
    .flatMap((p) => {
      const mine = byPatient.get(p.id);
      return mine ? [{ patient: p, cards: mine }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.cards.some((c) => c.badge)) -
        Number(a.cards.some((c) => c.badge)),
    );

  return (
    <Section title="Your patients">
      {rows.length === 0 ? (
        <EmptyState message="No patients on service yet. They sync from the EMR at admission." />
      ) : (
        rows.map((row) => (
          <PatientRowLink
            key={row.patient.id}
            patient={row.patient}
            cards={row.cards}
          />
        ))
      )}
    </Section>
  );
}

function DonStack({ cards }: StackProps) {
  const waiting = cards.filter((c) => c.awaiting);
  const atRisk = cards.filter((c) => c.badge === "AT_RISK").length;
  const openSpend = cards.reduce((sum, c) => sum + (c.order.price_cents ?? 0), 0);

  return (
    <>
      <section className="mt-6 flex gap-3">
        <Tile
          label="At risk"
          value={String(atRisk)}
          note={<SyntheticLabel>Sample data</SyntheticLabel>}
        />
        <Tile
          label="Open DME spend"
          value={cards.length === 0 ? "—" : formatUsd(openSpend)}
          note={<AssumedLabel>Monthly rental prices</AssumedLabel>}
        />
      </section>

      <Section title="Waiting on you">
        {waiting.length === 0 ? (
          <EmptyState message="No orders are waiting for your approval." />
        ) : (
          waiting.map((card) => <Card key={card.order.id} card={card} />)
        )}
      </Section>

      <Section title="Cost reporting">
        <EmptyState
          message="DME PPD lands in Reports."
          actionLabel="Open reports"
          actionHref="/reports"
        />
      </Section>
    </>
  );
}

type StackProps = {
  cards: Enriched[];
  patients: PatientRow[];
  at: Date;
};

const STACKS: Record<Role, (props: StackProps) => React.ReactNode> = {
  nurse: NurseStack,
  case_manager: CaseManagerStack,
  don: DonStack,
};

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const at = await now();
  const result = await loadToday(at);

  return (
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Today
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {session.userName} · {ROLE_FOCUS[session.role]}
      </p>

      {!result.ok ? (
        <div className="mt-4">
          {result.reason === "no-env" ? (
            <EmptyState message="Supabase key not set. Data appears after setup." />
          ) : (
            <RetryCard />
          )}
        </div>
      ) : (
        (() => {
          const cards = enrich(result.data, at);
          const attention = cards.filter((c) => c.badge);
          const amberCount = attention.filter((c) =>
            result.data.recentStatusChangeOrderIds.has(c.order.id),
          ).length;
          const Stack = STACKS[session.role];
          return (
            <>
              <NeedsAttention
                cards={attention}
                amberCount={amberCount}
                recentIds={result.data.recentStatusChangeOrderIds}
              />
              <Stack
                cards={cards}
                patients={result.data.patients}
                at={at}
              />
            </>
          );
        })()
      )}
    </section>
  );
}
