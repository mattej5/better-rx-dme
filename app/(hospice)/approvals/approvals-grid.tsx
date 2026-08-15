"use client";

import { useState } from "react";
import type { ApprovalActionState } from "@/app/actions/approvals";
import EmptyState from "@/components/empty-state";
import ApprovalCard from "./approval-card";
import type { ApprovalCardData } from "./data";

type Decision = ApprovalActionState & { orderId: string; at: number };

/**
 * The decided card disappears on the next revalidate, so its own result message
 * would go with it. The log lives here instead, above the grid, and survives the
 * refresh. Approvals are append-only; nothing here offers an undo.
 */
export default function ApprovalsGrid({
  cards,
  canAct,
}: {
  cards: ApprovalCardData[];
  canAct: boolean;
}) {
  const [decisions, setDecisions] = useState<Decision[]>([]);

  function record(orderId: string, result: ApprovalActionState) {
    setDecisions((prior) => [
      { ...result, orderId, at: Date.now() },
      ...prior.filter((d) => d.orderId !== orderId),
    ]);
  }

  return (
    <>
      {decisions.length > 0 ? (
        <div className="mt-5 flex flex-col gap-2">
          {decisions.map((decision) => (
            <p
              key={`${decision.orderId}-${decision.at}`}
              role="status"
              className="rounded-[var(--radius-card)] border p-3 text-[14px] font-semibold"
              style={
                decision.ok
                  ? { background: "var(--green-tint)", borderColor: "var(--green)", color: "var(--ink)" }
                  : { background: "var(--red-tint)", borderColor: "var(--red)", color: "var(--ink)" }
              }
            >
              {decision.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        {cards.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              message={
                decisions.length > 0
                  ? "Nothing else is waiting for approval."
                  : "No orders are waiting for approval."
              }
            />
          </div>
        ) : (
          cards.map((card) => (
            <ApprovalCard
              key={card.orderId}
              card={card}
              canAct={canAct}
              onDecision={(result) => record(card.orderId, result)}
            />
          ))
        )}
      </div>
    </>
  );
}
