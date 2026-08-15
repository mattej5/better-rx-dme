import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { HOSPICE_TIMEZONE } from "@/src/lib/domain";
import RetryCard from "../../../retry-card";
import { formatDate, loadPatientCard } from "../../../data";

export const dynamic = "force-dynamic";

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: HOSPICE_TIMEZONE,
});

/** Postgres returns `+00:00`, the event payload stores `Z` — compare instants, not strings. */
function requestedAtMatches(payload: unknown, changedAt: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const value = (payload as Record<string, unknown>).requested_at;
  return typeof value === "string" && Date.parse(value) === Date.parse(changedAt);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[70vh] bg-[var(--paper)]">
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Status change
      </h1>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function StatusChangeReceiptPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const result = await loadPatientCard(patientId);

  if (!result.ok) {
    return (
      <Shell>
        <RetryCard />
      </Shell>
    );
  }

  const { patient, orders, events } = result.data;

  if (!patient) {
    return (
      <Shell>
        <EmptyState
          message="We couldn't find that patient."
          actionLabel="All patients"
          actionHref="/patients"
        />
      </Shell>
    );
  }

  const changedAt = patient.status_changed_at;
  if (!changedAt) {
    return (
      <Shell>
        <EmptyState
          message="No status change recorded for this patient."
          actionLabel="Back to patient"
          actionHref={`/patients/${patient.id}`}
        />
      </Shell>
    );
  }

  // Re-derived from the events the fan-out wrote, so a refresh or a shared link
  // shows the same numbers the server action returned.
  const vendorIds = new Set<string>();
  let pickupsRequested = 0;
  for (const order of orders) {
    const wrote = (events.get(order.id) ?? []).some(
      (event) =>
        event.type === "pickup_requested" &&
        requestedAtMatches(event.payload, changedAt),
    );
    if (!wrote) continue;
    pickupsRequested += 1;
    if (order.vendor_id) vendorIds.add(order.vendor_id);
  }

  const vendorsNotified = vendorIds.size;
  const time = TIME_FMT.format(new Date(changedAt));

  const lines =
    pickupsRequested > 0
      ? [
          vendorsNotified === 1
            ? `1 vendor notified at ${time}`
            : `All ${vendorsNotified} vendors notified at ${time}`,
          "Equipment rental billing stopped",
          "Pickup being scheduled with family",
        ]
      : ["No rented equipment is in the home", "Nothing to pick up"];

  return (
    <section className="min-h-[70vh] bg-[var(--paper)]">
      <p className="text-[13px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        {patient.first_name} {patient.last_name} ·{" "}
        {patient.care_status === "deceased" ? "Deceased" : "Discharged"}
      </p>

      <p
        className="mt-4 text-[56px] leading-none"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {time}
      </p>
      <p className="mt-2 text-[14px] text-[var(--ink-soft)]">{formatDate(changedAt)}</p>

      <ul className="mt-8 flex flex-col gap-3 border-t border-[var(--line)] pt-6">
        {lines.map((line) => (
          <li key={line} className="text-[16px] leading-snug">
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-10">
        <Link
          href="/pickups"
          className="text-[15px] font-semibold underline underline-offset-4"
        >
          See pickups
        </Link>
      </div>
    </section>
  );
}
