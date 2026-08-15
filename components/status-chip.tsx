import type { Badge, OrderStatus } from "@/src/lib/domain";
import { BADGE_LABEL, STATUS_LABEL } from "@/src/lib/domain";

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  ordered: { bg: "var(--royal-tint)", fg: "#35618A" },
  dispatched: { bg: "var(--ocean-tint)", fg: "#1F7B92" },
  in_transit: { bg: "var(--burnt-tint)", fg: "var(--burnt-dark)" },
  delivered: { bg: "var(--green-tint)", fg: "#4A7D33" },
  pickup_triggered: { bg: "var(--purple-tint)", fg: "var(--purple)" },
  picked_up: { bg: "var(--green-tint)", fg: "#4A7D33" },
};

const chipBase =
  "inline-flex items-center gap-1 rounded-[var(--radius-badge)] px-2 py-[2px] text-[10.8px] font-bold uppercase tracking-[0.05em]";

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="11"
      height="11"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <path d="M8 1.2 15.2 14H0.8L8 1.2Zm0 4.3a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5Zm0 5.4a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}

export type StatusChipProps = {
  status: OrderStatus;
  /** Derived upstream by derive.ts and passed in. Never inferred from status. */
  badge?: Badge;
  awaitingApproval?: boolean;
};

export default function StatusChip({
  status,
  badge,
  awaitingApproval,
}: StatusChipProps) {
  const style = STATUS_STYLE[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={chipBase}
        style={{ background: style.bg, color: style.fg }}
      >
        {awaitingApproval ? "Awaiting approval" : STATUS_LABEL[status]}
      </span>
      {badge ? (
        <span
          className={chipBase}
          style={{ background: "var(--red-tint)", color: "#B4322A" }}
        >
          <AlertIcon />
          {BADGE_LABEL[badge]}
        </span>
      ) : null}
    </span>
  );
}
