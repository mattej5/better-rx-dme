import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import { getSession } from "@/src/lib/role";
import ApprovalCard from "./approval-card";
import { loadApprovals } from "./data";

export default async function ApprovalsPage() {
  const [loaded, session] = await Promise.all([loadApprovals(), getSession()]);

  return (
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

      <div className="mt-5 space-y-4">
        {!loaded.ok ? (
          <EmptyState message={loaded.reason === "no-env" ? "Supabase key not set. Approvals appear after setup." : "We couldn't load approvals. Try again."} />
        ) : loaded.cards.length === 0 ? (
          <EmptyState message="No orders are waiting for approval." />
        ) : (
          loaded.cards.map((card) => <ApprovalCard key={card.orderId} card={card} canAct={session?.role === "don"} />)
        )}
      </div>
    </section>
  );
}
