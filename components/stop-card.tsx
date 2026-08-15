"use client";

import type { StopVariant } from "@/src/lib/domain";

const VARIANT_TITLE: Record<StopVariant, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  oxygen_swap: "Oxygen swap",
};

export type StopCardItem = {
  hcpcs: string;
  plainName: string;
  qty?: number;
};

export type StopCardProps = {
  variant: StopVariant;
  hazmat: boolean;
  mode?: "compact" | "full";
  orderNo: string;
  patientLabel: string;
  address: string;
  windowLabel: string;
  items: StopCardItem[];
  /** Pickup only. Plain sentence from the hospice, e.g. scheduling around a service. */
  familyNote?: string;
  addressNote?: string;
  onOpen?: () => void; // STUB — navigation wired by N7/N9
  onPrimary?: () => void; // STUB — ON MY WAY / DELIVERED / DONE
  onDecline?: () => void; // STUB — decline with a reason
  primaryLabel?: string;
};

function HazmatBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-badge)] px-2 py-[2px] text-[10.8px] font-bold uppercase tracking-[0.05em]"
      style={{ background: "var(--burnt-tint)", color: "var(--burnt-dark)" }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="currentColor">
        <path d="M8 1.2 15.2 14H0.8L8 1.2Z" />
      </svg>
      Hazmat · oxygen
    </span>
  );
}

export default function StopCard({
  variant,
  hazmat,
  mode = "compact",
  orderNo,
  patientLabel,
  address,
  windowLabel,
  items,
  familyNote,
  addressNote,
  onOpen,
  onPrimary,
  onDecline,
  primaryLabel,
}: StopCardProps) {
  const full = mode === "full";
  const defaultPrimary =
    variant === "pickup"
      ? "Confirm pickup"
      : variant === "oxygen_swap"
        ? "Confirm swap"
        : "On my way";

  return (
    <article
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[16.5px] font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {VARIANT_TITLE[variant]}
          </p>
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            {orderNo} · {patientLabel}
          </p>
        </div>
        <p className="text-[13px] font-semibold text-[var(--ink)]">{windowLabel}</p>
      </div>

      {hazmat ? (
        <div className="mt-2">
          <HazmatBadge />
        </div>
      ) : null}

      <p className="mt-2 text-[14px]">{address}</p>
      {full && addressNote ? (
        <p className="text-[13px] text-[var(--ink-soft)]">{addressNote}</p>
      ) : null}

      <ul className="mt-2 m-0 list-none p-0">
        {items.slice(0, full ? items.length : 3).map((item) => (
          <li key={item.hcpcs} className="text-[14px]">
            {item.plainName}
            {item.qty && item.qty > 1 ? ` ×${item.qty}` : ""}{" "}
            <span className="text-[12px] text-[var(--ink-soft)]">{item.hcpcs}</span>
          </li>
        ))}
      </ul>

      {variant === "pickup" ? (
        <div className="mt-3 rounded-[8px] border-l-4 border-[var(--secondary)] bg-[var(--paper-alt)] px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
            Family coordination
          </p>
          <p className="text-[13.5px]">
            {familyNote ?? "No timing note from the hospice yet."}
          </p>
          {full ? (
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              Take a condition photo before you finish. Sanitize before restock.
            </p>
          ) : null}
        </div>
      ) : null}

      {variant === "oxygen_swap" && full ? (
        <p className="mt-3 text-[13.5px] text-[var(--ink-soft)]">
          Leave full cylinders and take the empties. One confirmation covers both.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {full ? (
          <>
            <button
              type="button"
              onClick={onPrimary}
              className="min-h-[56px] rounded-[var(--radius-btn)] text-[16px] font-extrabold uppercase tracking-[0.04em]"
              style={{ background: "var(--salmon)", color: "#24333F" }}
            >
              {primaryLabel ?? defaultPrimary}
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="min-h-[44px] rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink)]"
            >
              Decline stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="min-h-[44px] rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink)]"
          >
            Open stop
          </button>
        )}
      </div>
    </article>
  );
}
