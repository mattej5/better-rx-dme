"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { escalateOrder, reorderToBackup, type OrderActionState } from "@/app/actions/orders";
import { AssumedLabel } from "@/components/labels";
import { formatUsd, perDayCents } from "@/src/lib/domain";

export type EscalationSheetProps = {
  orderId: string;
  closeHref: string;
  /** Plain-English at-risk reason. Null once the risk has cleared. */
  reason: string | null;
  timeLeft: string | null;
  /** Pickups are never rerouted — the owning vendor retrieves its own equipment. */
  isPickup: boolean;
  /** The DON is the escalation point; do not offer escalating to themselves. */
  viewerIsDon: boolean;
  backup: { name: string; monthlyPriceCents: number; leadTimeHours: number } | null;
  currentPriceCents: number | null;
};

/** Prices are always shown per day. Stored values are the monthly rental. */
function priceDelta(backupCents: number, currentCents: number | null): string {
  if (currentCents === null) return `${formatUsd(perDayCents(backupCents))}/day`;
  const difference = perDayCents(backupCents) - perDayCents(currentCents);
  if (difference === 0) return "Same daily price";
  return `${difference > 0 ? "+" : "-"}${formatUsd(Math.abs(difference))}/day`;
}

function ActionRow({
  label,
  note,
  onClick,
  href,
  disabled,
  tone,
}: {
  label: string;
  note: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone: "primary" | "slate" | "quiet";
}) {
  const palette = {
    primary: { background: "var(--salmon)", color: "#24333F", border: "1px solid var(--salmon)" },
    slate: { background: "var(--secondary)", color: "#FFFFFF", border: "1px solid var(--secondary)" },
    quiet: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" },
  }[tone];
  const inner = (
    <>
      <span className="text-[14px] font-extrabold uppercase tracking-[0.04em]">{label}</span>
      <span className="mt-1 block text-[12.5px] font-normal normal-case tracking-normal opacity-90">
        {note}
      </span>
    </>
  );
  const className =
    "block w-full rounded-[var(--radius-btn)] px-4 py-3 text-left disabled:opacity-50";
  if (href) {
    return (
      <Link href={href} className={className} style={palette}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} style={palette}>
      {inner}
    </button>
  );
}

export default function EscalationSheet({
  orderId,
  closeHref,
  reason,
  timeLeft,
  isPickup,
  viewerIsDon,
  backup,
  currentPriceCents,
}: EscalationSheetProps) {
  const [result, setResult] = useState<OrderActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function escalate() {
    setResult(null);
    startTransition(async () => {
      setResult(await escalateOrder(orderId, reason ?? "Escalated from the order page."));
    });
  }

  function reorder() {
    setResult(null);
    startTransition(async () => {
      setResult(await reorderToBackup(orderId));
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <Link
        href={closeHref}
        aria-label="Close options"
        className="absolute inset-0"
        style={{ background: "rgba(36, 51, 63, 0.45)" }}
      />
      <section
        aria-label="Options for this order"
        className="relative w-full max-w-[430px] rounded-t-[16px] border-t border-[var(--line)] bg-[var(--surface)] px-5 pb-8 pt-5"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <h2 className="text-[19px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Options for this order
        </h2>

        {reason ? (
          <p className="mt-2 text-[14px] text-[var(--ink)]">{reason}</p>
        ) : (
          <p
            className="mt-2 rounded-[var(--radius-card)] p-3 text-[14px]"
            style={{ background: "var(--green-tint)", color: "#4A7D33" }}
          >
            This order is no longer at risk.
          </p>
        )}
        {timeLeft ? (
          <p className="mt-1 text-[13px] font-semibold text-[var(--ink-soft)]">{timeLeft}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <ActionRow
            tone="quiet"
            href={closeHref}
            label="WAIT"
            note="Nothing changes. The order stays on the board and keeps updating."
          />
          {viewerIsDon ? (
            <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3 text-[13px] text-[var(--ink-soft)]">
              This escalation ends with you. Pick an action below or call the vendor.
            </p>
          ) : (
            <ActionRow
              tone="slate"
              onClick={escalate}
              disabled={pending}
              label="ESCALATE TO DON"
              note="Adds an escalation to this order's record for the Director of Nursing."
            />
          )}
          {isPickup ? (
            <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3 text-[13px] text-[var(--ink-soft)]">
              Pickups are not rerouted. The owning vendor retrieves its own equipment.
            </p>
          ) : backup ? (
            <ActionRow
              tone="primary"
              onClick={reorder}
              disabled={pending}
              label="REORDER FROM BACKUP"
              note={`${backup.name} · ${priceDelta(backup.monthlyPriceCents, currentPriceCents)} · ready in about ${backup.leadTimeHours} hours`}
            />
          ) : (
            <p className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3 text-[13px] text-[var(--ink-soft)]">
              No other contracted vendor carries every item. Ask your DON.
            </p>
          )}
        </div>

        {backup && !isPickup ? (
          <p className="mt-3">
            <AssumedLabel>Lead time and stock are estimates</AssumedLabel>
          </p>
        ) : null}

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
          Nothing is cancelled automatically. You choose.
        </p>
      </section>
    </div>
  );
}
