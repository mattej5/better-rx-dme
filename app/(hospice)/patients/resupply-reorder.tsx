"use client";

import { useState, useTransition } from "react";
import { reorderResupply, type ResupplyActionState } from "@/app/actions/resupply";

export default function ResupplyReorder({
  scheduleId,
  dueLabel,
}: {
  scheduleId: string;
  dueLabel: string;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ResupplyActionState | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <p className="text-[13px] text-[var(--ink-soft)]">Resupply due {dueLabel}</p>
      {state?.ok ? null : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setState(await reorderResupply(scheduleId));
            })
          }
          className="rounded-[3px] bg-[var(--brand)] px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-white disabled:opacity-60"
        >
          {pending ? "Reordering…" : "Reorder"}
        </button>
      )}
      {state ? (
        <p className="basis-full text-[13px] text-[var(--ink-soft)]">{state.message}</p>
      ) : null}
    </div>
  );
}
