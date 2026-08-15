import { Suspense } from "react";

import EmptyState from "@/components/empty-state";
import SkeletonStack from "@/components/skeleton-stack";
import RetryCard from "../../retry-card";
import { loadOrderFlow } from "./data";
import OrderFlow from "./order-flow";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const result = await loadOrderFlow(patientId);

  if (!result.ok) {
    return (
      <section>
        <h1
          className="text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          New order
        </h1>
        <div className="mt-4">
          {result.missing ? (
            <EmptyState
              message="We couldn't find that patient."
              actionLabel="All patients"
              actionHref="/patients"
            />
          ) : (
            <RetryCard />
          )}
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={<SkeletonStack rows={3} />}>
      <OrderFlow patientId={patientId} data={result.data} />
    </Suspense>
  );
}
