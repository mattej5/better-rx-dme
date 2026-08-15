"use client";

import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { formatTime, formatUsd, perDayCents } from "@/src/lib/domain";

export type VendorCompareCardProps = {
  vendorName: string;
  /** Monthly rental price in cents (vendor_prices.price_cents). Displayed per-day. */
  price: number;
  /** ISO timestamp of the promised arrival. */
  eta: string;
  /** ISO timestamp the order must land by (orders.target_at). Drives the track. */
  deadline?: string;
  meetsDeadline: boolean;
  reliability: number | "unrated";
  condition: number | "unrated";
  hoursBadge?: string;
  stockLabel?: string;
  selected?: boolean;
  onSelect?: () => void; // STUB — N7/N9 wire selection here
};

function Score({ value }: { value: number | "unrated" }) {
  if (value === "unrated") {
    return <span className="text-[15px] font-semibold">Unrated</span>;
  }
  return <span className="text-[15px] font-semibold">{value}%</span>;
}

function DeadlineTrack({
  eta,
  deadline,
  meetsDeadline,
}: {
  eta: string;
  deadline: string;
  meetsDeadline: boolean;
}) {
  const etaMs = new Date(eta).getTime();
  const deadlineMs = new Date(deadline).getTime();
  const lo = Math.min(etaMs, deadlineMs);
  const hi = Math.max(etaMs, deadlineMs);
  const pad = Math.max((hi - lo) * 0.35, 15 * 60 * 1000);
  const start = lo - pad;
  const end = hi + pad;
  const pct = (ms: number) => ((ms - start) / (end - start)) * 100;
  const etaPct = pct(etaMs);
  const deadlinePct = pct(deadlineMs);
  const barColor = meetsDeadline ? "var(--green)" : "var(--red)";

  return (
    <div className="mt-3">
      <div className="relative h-[26px]">
        <div className="absolute top-[11px] h-[4px] w-full rounded bg-[var(--line)]" />
        <div
          className="absolute top-[11px] h-[4px] rounded"
          style={{
            background: barColor,
            left: `${Math.min(etaPct, deadlinePct)}%`,
            width: `${Math.abs(deadlinePct - etaPct)}%`,
          }}
        />
        <div
          className="absolute top-[5px] h-[16px] w-[3px] rounded"
          style={{ background: "var(--ink)", left: `${deadlinePct}%` }}
        />
        <div
          className="absolute top-[7px] h-[12px] w-[12px] -translate-x-1/2 rounded-full border-2 border-white"
          style={{ background: barColor, left: `${etaPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11.5px] text-[var(--ink-soft)]">
        <span>Arrives {formatTime(eta)}</span>
        <span>Needed by {formatTime(deadline)}</span>
      </div>
    </div>
  );
}

export default function VendorCompareCard({
  vendorName,
  price,
  eta,
  deadline,
  meetsDeadline,
  reliability,
  condition,
  hoursBadge,
  stockLabel,
  selected = false,
  onSelect,
}: VendorCompareCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full rounded-[var(--radius-card)] border bg-[var(--surface)] p-4 text-left"
      style={{
        borderColor: selected ? "var(--salmon)" : "var(--line)",
        borderWidth: selected ? 2 : 1,
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[17px] font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {vendorName}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
            {meetsDeadline ? "Meets the deadline" : "Misses the deadline"}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[19px] font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {formatUsd(perDayCents(price))}
            <span className="text-[13px] font-medium">/day</span>
          </p>
          <AssumedLabel>Assumed daily rate</AssumedLabel>
        </div>
      </div>

      {deadline ? (
        <DeadlineTrack eta={eta} deadline={deadline} meetsDeadline={meetsDeadline} />
      ) : (
        <p className="mt-2 text-[13.5px]">Arrives {formatTime(eta)}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
            On time
          </p>
          <Score value={reliability} />
        </div>
        <div>
          <p className="text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
            Condition
          </p>
          <Score value={condition} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hoursBadge ? (
          <span className="rounded-[var(--radius-badge)] bg-[var(--paper-alt)] px-2 py-[2px] text-[11px] font-semibold text-[var(--ink-soft)]">
            {hoursBadge}
          </span>
        ) : null}
        {stockLabel ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
            {stockLabel}
            <AssumedLabel />
          </span>
        ) : null}
      </div>

      <div className="mt-2">
        <SyntheticLabel>Synthetic scores</SyntheticLabel>
      </div>
    </button>
  );
}
