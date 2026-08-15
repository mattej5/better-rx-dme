import Link from "next/link";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import StatusChip from "@/components/status-chip";
import { SyntheticLabel } from "@/components/labels";
import { deriveBadges, awaitingApproval } from "@/src/lib/derive";
import type { Badge, OrderStatus } from "@/src/lib/domain";
import RetryCard from "./retry-card";
import { loadRoster, statusRank, type RosterEntry } from "./data";

export const dynamic = "force-dynamic";

type Worst = {
  status: OrderStatus;
  badge?: Badge;
  awaiting: boolean;
} | null;

/** Worst = any badged order first, otherwise the least-progressed order. */
function worstOf(entry: RosterEntry): Worst {
  let best: Worst = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const order of entry.orders) {
    const events = entry.events.get(order.id) ?? [];
    const badges = deriveBadges(events);
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

export default async function PatientsPage() {
  const result = await loadRoster();

  return (
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Patients
      </h1>

      <div className="mt-4">
        {!result.ok ? (
          <RetryCard />
        ) : result.data.length === 0 ? (
          <EmptyState message="No patients yet. They arrive from the EMR at admission." />
        ) : (
          <ul className="flex flex-col gap-3">
            {result.data.map((entry) => {
              const worst = worstOf(entry);
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
