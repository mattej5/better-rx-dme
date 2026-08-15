"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmParsedReply } from "../actions";

/**
 * The nurse half of the confidence gate. Under 0.75 the parse changed nothing;
 * this is where a person accepts it or leaves it alone. Rejecting writes no event —
 * it just points at the phone.
 */
/** Intents that have a state change to accept. Others only have a phone call. */
const ACTIONABLE = ["confirm", "eta", "delay", "decline"];

export default function ParseConfirm({
  orderId,
  messageId,
  intent,
  vendorPhone,
}: {
  orderId: string;
  messageId: string;
  intent: string;
  vendorPhone: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (state?.ok) {
    return <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{state.message}</p>;
  }

  // Nothing to accept: there is no reading to apply, so the only honest next step
  // is a person on the phone.
  if (!ACTIONABLE.includes(intent)) {
    return (
      <div className="mt-2">
        {vendorPhone ? (
          <a
            href={`tel:${vendorPhone}`}
            className="inline-flex min-h-[40px] items-center rounded-[var(--radius-btn)] px-3 text-[12px] font-extrabold uppercase tracking-[0.04em]"
            style={{ background: "var(--salmon)", color: "#24333F" }}
          >
            Call vendor
          </a>
        ) : null}
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          The order still shows its last known time.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await confirmParsedReply(orderId, messageId);
              setState(result);
              if (result.ok) router.refresh();
            })
          }
          className="min-h-[40px] rounded-[var(--radius-btn)] px-3 text-[12px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50"
          style={{ background: "var(--secondary)", color: "#FFFFFF" }}
        >
          {pending ? "Applying" : "That's right"}
        </button>
        {!dismissed ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-[40px] rounded-[var(--radius-btn)] border border-[var(--line)] px-3 text-[12px] font-extrabold uppercase tracking-[0.04em]"
          >
            Not right
          </button>
        ) : null}
        {dismissed && vendorPhone ? (
          <a
            href={`tel:${vendorPhone}`}
            className="flex min-h-[40px] items-center rounded-[var(--radius-btn)] px-3 text-[12px] font-extrabold uppercase tracking-[0.04em]"
            style={{ background: "var(--salmon)", color: "#24333F" }}
          >
            Call vendor
          </a>
        ) : null}
      </div>
      {dismissed ? (
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          Nothing was changed on the order.
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="mt-1 text-[12.5px] text-[var(--burnt-dark)]">{state.message}</p>
      ) : null}
    </div>
  );
}
