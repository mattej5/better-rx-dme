import EmptyState from "@/components/empty-state";
import RetryCard from "../../retry-card";
import { loadPatientCard } from "../../data";
import StatusChangeFlow from "./status-change-flow";

export const dynamic = "force-dynamic";

export default async function StatusChangePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const result = await loadPatientCard(patientId);

  if (!result.ok) {
    return (
      <section className="min-h-[70vh] bg-[var(--paper)]">
        <h1
          className="text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Status change
        </h1>
        <div className="mt-4">
          <RetryCard />
        </div>
      </section>
    );
  }

  const { patient } = result.data;

  if (!patient) {
    return (
      <section className="min-h-[70vh] bg-[var(--paper)]">
        <h1
          className="text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Status change
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

  return (
    <StatusChangeFlow
      patientId={patient.id}
      patientName={`${patient.first_name} ${patient.last_name}`}
    />
  );
}
