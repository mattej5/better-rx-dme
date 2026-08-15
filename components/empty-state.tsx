"use client";

import Link from "next/link";

export type EmptyStateProps = {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void; // STUB
};

export default function EmptyState({
  message,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const cls =
    "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-btn)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]";
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 text-center">
      <p className="text-[15px]">{message}</p>
      {actionLabel ? (
        <div className="mt-3">
          {actionHref ? (
            <Link
              href={actionHref}
              className={cls}
              style={{ background: "var(--salmon)", color: "#24333F" }}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className={cls}
              style={{ background: "var(--salmon)", color: "#24333F" }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
