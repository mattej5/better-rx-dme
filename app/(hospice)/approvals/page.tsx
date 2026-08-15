import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import { getSession } from "@/src/lib/role";
import { formatUsd } from "@/src/lib/domain";
import WideColumn from "../wide-column";
import ApprovalCard from "./approval-card";
import { loadApprovals } from "./data";

export default async function ApprovalsPage() {
  const [loaded, session] = await Promise.all([loadApprovals(), getSession()]);
  const pendingTotalCents = loaded.ok
    ? loaded.cards.reduce((sum, card) => sum + (card.monthlyPriceCents ?? 0), 0)
    : 0;

  return (
    <WideColumn>
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Approvals
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {!loaded.ok ? "Orders needing a DON decision." : `${loaded.cards.length} pending ${loaded.cards.length === 1 ? "order" : "orders"}`}
      </p>

      {loaded.ok && loaded.cards.length > 0 ? (
        <div className="mt-4 hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-ink-soft">
            Pending monthly total
          </p>
          <p
            className="mt-1 text-[30px] leading-none"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            {formatUsd(pendingTotalCents)}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Across {loaded.cards.length} {loaded.cards.length === 1 ? "order" : "orders"} waiting on you
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        {!loaded.ok ? (
          <div className="lg:col-span-2">
            <EmptyState message={loaded.reason === "no-env" ? "Supabase key not set. Approvals appear after setup." : "We couldn't load approvals. Try again."} />
          </div>
        ) : loaded.cards.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState message="No orders are waiting for approval." />
          </div>
        ) : (
          loaded.cards.map((card) => <ApprovalCard key={card.orderId} card={card} canAct={session?.role === "don"} />)
        )}
      </div>
    </section>
    </WideColumn>
  );
}
