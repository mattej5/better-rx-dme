"use client";

import { useState, useTransition } from "react";
import { requestReplacementOrder, type OrderActionState } from "@/app/actions/orders";

export default function ReplacementButton({
  orderId,
  conditionEventId,
  issueLabel,
}: {
  orderId: string;
  conditionEventId?: number;
  issueLabel: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<OrderActionState | null>(null);

  if (state?.ok) {
    return (
      <p className="mt-3 rounded-[3px] border border-[var(--line)] bg-[var(--paper)] p-3 text-[14px]">
        {state.message}
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-[3px] border border-[var(--line)] p-3">
      <p className="text-[14px] font-semibold">This equipment was reported {issueLabel}.</p>
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        Ask the same vendor for a working replacement within 4 hours, at no charge.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setState(await requestReplacementOrder(orderId, conditionEventId));
          })
        }
        className="mt-3 w-full rounded-[3px] bg-[var(--brand)] px-4 py-3 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white disabled:opacity-60"
      >
        {pending ? "Requesting…" : "Request replacement"}
      </button>
      {state && !state.ok ? (
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{state.message}</p>
      ) : null}
    </div>
  );
}
