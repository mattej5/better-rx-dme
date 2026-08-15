"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordManualStatus, type OrderActionState } from "@/app/actions/orders";
import type { ManualStep } from "@/src/lib/manual-status";

export type StatusSheetProps = {
  orderId: string;
  closeHref: string;
  steps: ManualStep[];
};

export default function StatusSheet({ orderId, closeHref, steps }: StatusSheetProps) {
  const router = useRouter();
  const [result, setResult] = useState<OrderActionState | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <Link
        href={closeHref}
        replace
        scroll={false}
        aria-label="Close status update"
        className="absolute inset-0"
        style={{ background: "rgba(36, 51, 63, 0.45)" }}
      />
      <section
        aria-label="Update this order"
        className="relative w-full max-w-[430px] rounded-t-[16px] border-t border-[var(--line)] bg-[var(--surface)] px-5 pb-8 pt-5"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <h2 className="text-[19px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          What did the vendor say?
        </h2>
        <p className="mt-2 text-[14px] text-[var(--ink)]">
          Pick what you were told on the phone. It goes on this order&apos;s record with your name.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {steps.map((step) => (
            <button
              key={step.event}
              type="button"
              disabled={pending}
              onClick={() => {
                setResult(null);
                startTransition(async () => {
                  const outcome = await recordManualStatus(orderId, step.event);
                  setResult(outcome);
                  if (outcome.ok) router.replace(closeHref, { scroll: false });
                });
              }}
              className="block w-full rounded-[var(--radius-btn)] px-4 py-3 text-left text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50"
              style={{ background: "var(--salmon)", color: "#24333F" }}
            >
              {step.label}
            </button>
          ))}
          <Link
            href={closeHref}
            replace
            scroll={false}
            className="block w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-[14px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink)]"
          >
            NEVER MIND
          </Link>
        </div>

        {result ? (
          <p
            role="status"
            className="mt-3 text-[13px] font-semibold"
            style={{ color: result.ok ? "#4A7D33" : "#B4322A" }}
          >
            {result.message}
          </p>
        ) : null}

        <p className="mt-4 text-center text-[12px] text-[var(--ink-soft)]">
          The vendor is not messaged. This only records what you heard.
        </p>
      </section>
    </div>
  );
}
