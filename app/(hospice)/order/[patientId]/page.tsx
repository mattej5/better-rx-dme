import EmptyState from "@/components/empty-state";
import { SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { isFlowStep, loadOrderContext } from "./data";
import OrderFlow from "./order-flow";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const stepParam = firstValue(query.step);
  const step = isFlowStep(stepParam) ? stepParam : "items";

  const virtualNow = await now();
  const context = await loadOrderContext(patientId, virtualNow);

  if (!context.patient) {
    return (
      <section>
        <h1 className="text-[22px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          New order
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
    <>
      {context.source === "fixture" ? (
        <p className="mb-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] px-3 py-2 text-[12.5px] text-[var(--ink-soft)]">
          Not connected to the database. Catalog, vendors and prices below are sample data.{" "}
          <SyntheticLabel />
        </p>
      ) : null}
      <OrderFlow
        step={step}
        patientId={context.patient.id}
        patientName={`${context.patient.firstName} ${context.patient.lastName}`}
        context={context}
        nowIso={virtualNow.toISOString()}
      />
    </>
  );
}
