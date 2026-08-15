import Link from "next/link";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import StatusChip from "@/components/status-chip";
import { SyntheticLabel } from "@/components/labels";
import { deriveBadges, awaitingApproval } from "@/src/lib/derive";
import { now } from "@/src/lib/clock";
import type { Badge, OrderStatus } from "@/src/lib/domain";
import RetryCard from "./retry-card";
import {
  daysSince,
  formatDate,
  loadRoster,
  statusRank,
  type RosterEntry,
} from "./data";

export const dynamic = "force-dynamic";

const SEGMENTS = [
  { key: "onservice", label: "On service" },
  { key: "pickups", label: "Pickups" },
  { key: "past", label: "Past" },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]["key"];

function isSegment(value: string | undefined): value is SegmentKey {
  return value === "onservice" || value === "pickups" || value === "past";
}

function inSegment(entry: RosterEntry, key: SegmentKey): boolean {
  const care = entry.patient.care_status;
  if (key === "onservice")
    return care === "active" || care === "discharge_scheduled";
  if (key === "past") return care === "deceased" || care === "discharged";
  return entry.orders.some((o) => o.status === "pickup_triggered");
}

/** Earliest still-open pickup request, so the elapsed line reports the longest wait. */
function pickupOpenedAt(entry: RosterEntry): string | null {
  let earliest: string | null = null;
  for (const order of entry.orders) {
    if (order.status !== "pickup_triggered") continue;
    const at = order.pickup_requested_at;
    if (!at) continue;
    if (!earliest || Date.parse(at) < Date.parse(earliest)) earliest = at;
  }
  return earliest;
}

/** Plain, calm copy. Death is stated, never styled as an alarm. */
function careStatusLine(entry: RosterEntry): string | null {
  const { care_status, status_changed_at, discharge_at } = entry.patient;
  if (care_status === "deceased")
    return status_changed_at ? `Deceased ${formatDate(status_changed_at)}` : "Deceased";
  if (care_status === "discharged") {
    const at = discharge_at ?? status_changed_at;
    return at ? `Discharged ${formatDate(at)}` : "Discharged";
  }
  return null;
}

type Worst = {
  status: OrderStatus;
  badge?: Badge;
  awaiting: boolean;
} | null;

/** Worst = any badged order first, otherwise the least-progressed order. */
function worstOf(entry: RosterEntry, at: Date): Worst {
  let best: Worst = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const order of entry.orders) {
    const events = entry.events.get(order.id) ?? [];
    const badges = deriveBadges(events, { now: at });
    const badge = badges[0];
    const score = badge ? -1 : statusRank(order.status);
    if (score < bestScore) {
      bestScore = score;
      best = {
        status: order.status,
        badge,
        awaiting: awaitingApproval(events),
      };
    }
  }
  return best;
}

function SegmentChips({
  active,
  counts,
}: {
  active: SegmentKey;
  counts: Record<SegmentKey, number>;
}) {
  return (
    <nav className="mt-4 flex gap-2 overflow-x-auto">
      {SEGMENTS.map((segment) => {
        const on = segment.key === active;
        return (
          <Link
            key={segment.key}
            href={`/patients?show=${segment.key}`}
            replace
            aria-current={on ? "page" : undefined}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-btn)] border px-4 text-[13px] uppercase tracking-[0.04em]"
            style={
              on
                ? {
                    background: "var(--salmon)",
                    borderColor: "var(--salmon)",
                    color: "#24333F",
                    fontWeight: 800,
                  }
                : {
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                    fontWeight: 600,
                  }
            }
          >
            {segment.label} {counts[segment.key]}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const [params, virtualNow, result] = await Promise.all([
    searchParams,
    now(),
    loadRoster(),
  ]);
  const active: SegmentKey = isSegment(params.show) ? params.show : "onservice";

  const counts: Record<SegmentKey, number> = {
    onservice: 0,
    pickups: 0,
    past: 0,
  };
  const shown: RosterEntry[] = [];
  if (result.ok) {
    for (const entry of result.data) {
      for (const segment of SEGMENTS) {
        if (inSegment(entry, segment.key)) counts[segment.key] += 1;
      }
      if (inSegment(entry, active)) shown.push(entry);
    }
  }

  return (
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Patients
      </h1>

      {result.ok && result.data.length > 0 ? (
        <SegmentChips active={active} counts={counts} />
      ) : null}

      <div className="mt-4">
        {!result.ok ? (
          <RetryCard />
        ) : result.data.length === 0 ? (
          <EmptyState message="No patients yet. They arrive from the EMR at admission." />
        ) : shown.length === 0 ? (
          <EmptyState
            message={
              active === "onservice"
                ? "No one on service right now."
                : "No one here right now."
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((entry) => {
              const worst = worstOf(entry, virtualNow);
              const careLine = active === "past" ? careStatusLine(entry) : null;
              const openedAt =
                active === "pickups" ? pickupOpenedAt(entry) : null;
              const openDays = openedAt
                ? daysSince(openedAt, virtualNow)
                : null;
              return (
                <li key={entry.patient.id}>
                  <Link
                    href={`/patients/${entry.patient.id}`}
                    className="block rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
                  >
                    <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
                      {entry.patient.first_name} {entry.patient.last_name}
                    </p>
                    <p className="mt-0.5">
                      <SyntheticLabel>
                        Synced from {entry.patient.emr_source}
                      </SyntheticLabel>
                    </p>
                    {careLine ? (
                      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                        {careLine}
                      </p>
                    ) : null}
                    {openDays !== null ? (
                      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                        Pickup open {openDays}{" "}
                        {openDays === 1 ? "day" : "days"}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      {worst ? (
                        <StatusChip
                          status={worst.status}
                          badge={worst.badge}
                          awaitingApproval={worst.awaiting}
                        />
                      ) : (
                        <span className="text-[13px] text-[var(--ink-soft)]">
                          No equipment on order
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
