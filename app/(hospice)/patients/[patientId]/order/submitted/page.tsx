import Link from "next/link";

import ApprovalInterstitial from "@/components/approval-interstitial";
import EmptyState from "@/components/empty-state";
import RetryCard from "../../../retry-card";
import { loadSubmission } from "./data";

export const dynamic = "force-dynamic";

export default async function OrderSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ orders?: string }>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const ids = (query.orders ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const result = await loadSubmission(ids);

  if (!result.ok) {
    return (
      <section>
        <div className="mt-2">
          <RetryCard />
        </div>
      </section>
    );
  }

  if (!result.data) {
    return (
      <section>
        <div className="mt-2">
          <EmptyState
            message="We couldn't find that order."
            actionLabel="Patient card"
            actionHref={`/patients/${patientId}`}
          />
        </div>
      </section>
    );
  }

  const { orderNo, vendorName, priceCents, cheapestVendorName, cheapestPriceCents, orderCount } =
    result.data;

  return (
    <section>
      <ApprovalInterstitial
        orderNo={orderCount > 1 ? `${orderNo} and ${orderCount - 1} more` : orderNo}
        vendorName={vendorName}
        price={priceCents}
        cheapestPrice={cheapestPriceCents}
        cheapestVendorName={cheapestVendorName}
      />

      <div className="mt-5 flex flex-col gap-3">
        <Link
          href={`/orders/${result.data.firstOrderId}`}
          className="inline-flex min-h-[48px] items-center justify-center rounded-[var(--radius-btn)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]"
          style={{ background: "var(--secondary)", color: "#FFFFFF" }}
        >
          SEE ORDER
        </Link>
        <Link
          href={`/patients/${patientId}`}
          className="inline-flex min-h-[48px] items-center justify-center rounded-[var(--radius-btn)] border border-[var(--line)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]"
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          BACK TO PATIENT
        </Link>
      </div>
    </section>
  );
}
