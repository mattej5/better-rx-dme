"use client";

import Link from "next/link";

export type RiskBannerProps = {
  title?: string;
  /** Plain-English explanation. Always visible — never a tooltip. */
  reason: string;
  timeLeft?: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void; // STUB — N7/N9 wire the action here
  updatedJustNow?: boolean;
};

export default function RiskBanner({
  title = "At risk",
  reason,
  timeLeft,
  actionLabel,
  actionHref,
  onAction,
  updatedJustNow = false,
}: RiskBannerProps) {
  const actionClass =
    "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-btn)] bg-[var(--secondary)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white";

  return (
    <div
      role="status"
      className="rounded-[var(--radius-card)] border p-4"
      style={{ background: "#FBEAE9", borderColor: "var(--red)" }}
    >
      <p
        className="text-[15px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "#B4322A" }}
      >
        {title}
      </p>
      <p className="mt-1 text-[14px] text-[var(--ink)]">{reason}</p>
      {timeLeft ? (
        <p className="mt-1 text-[13px] font-semibold text-[var(--ink-soft)]">
          {timeLeft}
        </p>
      ) : null}
      {updatedJustNow ? (
        <p className="mt-1 text-[12px] text-[var(--ink-soft)]">Updated just now</p>
      ) : null}
      <div className="mt-3">
        {actionHref ? (
          <Link href={actionHref} className={actionClass}>
            {actionLabel}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className={actionClass}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
