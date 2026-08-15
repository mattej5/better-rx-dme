"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nudgeVendor } from "../actions";

const btn =
  "inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--radius-btn)] px-3 text-[12.5px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50";

export default function OrderActions({
  orderId,
  vendorPhone,
  closed,
}: {
  orderId: string;
  vendorPhone: string | null;
  /** Delivered or picked up — there is nothing left to chase. */
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (closed) return null;

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await nudgeVendor(orderId);
              setMessage(result.message);
              if (result.ok) router.refresh();
            })
          }
          className={btn}
          style={{ background: "var(--salmon)", color: "#24333F" }}
        >
          {pending ? "Sending" : "Nudge again"}
        </button>
        {vendorPhone ? (
          <a href={`tel:${vendorPhone}`} className={btn} style={{ background: "var(--secondary)", color: "#FFFFFF" }}>
            Call vendor
          </a>
        ) : null}
        <Link
          href={`/orders/${orderId}?sheet=escalate`}
          className={`${btn} border border-[var(--line)]`}
          scroll={false}
        >
          More options
        </Link>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-[13px] text-[var(--ink-soft)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
