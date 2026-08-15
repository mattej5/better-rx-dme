"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BigActionButton from "@/components/big-action-button";
import EmptyState from "@/components/empty-state";
import VendorCompareCard from "@/components/vendor-compare-card";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { formatDayTime, formatUsd, perDayCents, type OrderUrgency } from "@/src/lib/domain";
import { placeOrder } from "@/app/actions/place-order";
import { clearDraft, type DraftItem } from "./draft";
import type { VendorOption } from "./types";

export type VendorQuote = {
  vendor: VendorOption;
  totalMonthlyCents: number;
  perDayCents: number;
  etaIso: string;
  meetsDeadline: boolean;
  allInStock: boolean;
  reliability: number | "unrated";
  condition: number | "unrated";
  /** Items whose own unit price × qty crosses the DON threshold. */
  overThreshold: DraftItem[];
};

function scoreValue(score: { score: number | null }): number | "unrated" {
  return score.score === null ? "unrated" : score.score;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Reliability-led ranking. Deadline feasibility first (an order that misses is not a
 * cheaper option, it is a failure), then the on-time record from derive.ts, then price.
 * Unrated vendors sort after rated ones — they are shown, never hidden, never zeroed.
 */
function rank(a: VendorQuote, b: VendorQuote): number {
  if (a.meetsDeadline !== b.meetsDeadline) return a.meetsDeadline ? -1 : 1;
  const ar = a.reliability === "unrated" ? -1 : a.reliability;
  const br = b.reliability === "unrated" ? -1 : b.reliability;
  if (ar !== br) return br - ar;
  return a.totalMonthlyCents - b.totalMonthlyCents;
}

export default function VendorStep({
  patientId,
  patientName,
  vendors,
  items,
  urgency,
  targetIso,
  nowIso,
  reason,
  donThresholdCents,
  donThresholdFromSettings,
  selectedVendorId,
  onSelectVendor,
  onBack,
}: {
  patientId: string;
  patientName: string;
  vendors: VendorOption[];
  items: DraftItem[];
  urgency: OrderUrgency;
  targetIso: string;
  nowIso: string;
  reason: string;
  donThresholdCents: number;
  donThresholdFromSettings: boolean;
  selectedVendorId: string | null;
  onSelectVendor: (vendorId: string) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const quotes = useMemo(() => {
    const nowMs = new Date(nowIso).getTime();
    const targetMs = new Date(targetIso).getTime();
    const list: VendorQuote[] = [];

    for (const vendor of vendors) {
      if (!items.every((i) => vendor.prices[i.hcpcs])) continue;

      let totalMonthlyCents = 0;
      let maxLeadHours = 0;
      let allInStock = true;
      const overThreshold: DraftItem[] = [];

      for (const item of items) {
        const price = vendor.prices[item.hcpcs];
        const lineCents = price.monthlyCents * item.qty;
        totalMonthlyCents += lineCents;
        maxLeadHours = Math.max(maxLeadHours, price.leadTimeHours);
        if (!price.inStock) allInStock = false;
        if (lineCents >= donThresholdCents) overThreshold.push(item);
      }

      const etaMs = nowMs + maxLeadHours * 60 * 60 * 1000;
      list.push({
        vendor,
        totalMonthlyCents,
        perDayCents: perDayCents(totalMonthlyCents),
        etaIso: new Date(etaMs).toISOString(),
        meetsDeadline: etaMs <= targetMs,
        allInStock,
        reliability: scoreValue(vendor.reliability),
        condition: scoreValue(vendor.condition),
        overThreshold,
      });
    }

    return list.sort(rank);
  }, [vendors, items, nowIso, targetIso, donThresholdCents]);

  const best = quotes[0];
  const chosen = quotes.find((q) => q.vendor.id === selectedVendorId) ?? best;
  const others = quotes.filter((q) => q.vendor.id !== chosen?.vendor.id);
  const onTime = others.filter((q) => q.meetsDeadline);
  const late = others.filter((q) => !q.meetsDeadline);

  const dayPrices = quotes.map((q) => q.perDayCents);
  const averagePerDay = dayPrices.length
    ? Math.round(dayPrices.reduce((s, x) => s + x, 0) / dayPrices.length)
    : 0;
  const medianPerDay = dayPrices.length ? median(dayPrices) : 0;

  if (quotes.length === 0) {
    return (
      <div>
        <h1 className="text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Who should bring it?
        </h1>
        <div className="mt-4">
          <EmptyState message="No contracted vendor carries every item on this order. Ask your DON." />
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] rounded-[var(--radius-btn)] border border-[var(--line)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const needsApproval = (chosen?.overThreshold.length ?? 0) > 0;

  function submit() {
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      const result = await placeOrder({
        patientId,
        vendorId: chosen.vendor.id,
        urgency,
        targetAt: targetIso,
        reason,
        items: items.map((i) => ({ hcpcs: i.hcpcs, plainName: i.plainName, qty: i.qty })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      clearDraft(patientId);
      router.push(
        `/order/${patientId}/submitted?ids=${result.orders.map((o) => o.id).join(",")}`,
      );
    });
  }

  return (
    <div className="pb-6">
      <h1 className="text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
        Who should bring it?
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        We picked the vendor with the best on-time record that still makes{" "}
        {formatDayTime(targetIso)}. Tap another card to change it.
      </p>

      <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3">
        <p className="text-[13.5px]">
          <span className="font-semibold">{formatUsd(averagePerDay)}/day</span> average,{" "}
          <span className="font-semibold">{formatUsd(medianPerDay)}/day</span> middle price
          across {quotes.length} {quotes.length === 1 ? "vendor" : "vendors"}.
        </p>
        <p className="mt-1">
          <AssumedLabel>Daily rate estimated as the monthly rental ÷ 30</AssumedLabel>
        </p>
      </div>

      {chosen ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--burnt-dark)]">
            Best pick
          </p>
          <div className="mt-1">
            <VendorCompareCard
              vendorName={chosen.vendor.name}
              price={chosen.totalMonthlyCents}
              eta={chosen.etaIso}
              deadline={targetIso}
              meetsDeadline={chosen.meetsDeadline}
              reliability={chosen.reliability}
              condition={chosen.condition}
              hoursBadge={chosen.vendor.openWeekends ? "Open weekends" : "Weekdays only"}
              stockLabel={chosen.allInStock ? "In stock" : "Some items not in stock"}
              selected
              onSelect={() => onSelectVendor(chosen.vendor.id)}
            />
          </div>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            {chosen.reliability === "unrated"
              ? "This vendor has fewer than 5 finished orders with us, so there is no on-time record yet. Nothing is being claimed about them."
              : `${chosen.reliability}% of this vendor's orders arrived by the time the hospice asked for.`}
          </p>
        </div>
      ) : null}

      {onTime.length > 0 ? (
        <div className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
            Also makes the deadline
          </h2>
          <div className="mt-2 flex flex-col gap-3">
            {onTime.map((q) => (
              <VendorCompareCard
                key={q.vendor.id}
                vendorName={q.vendor.name}
                price={q.totalMonthlyCents}
                eta={q.etaIso}
                deadline={targetIso}
                meetsDeadline={q.meetsDeadline}
                reliability={q.reliability}
                condition={q.condition}
                hoursBadge={q.vendor.openWeekends ? "Open weekends" : "Weekdays only"}
                stockLabel={q.allInStock ? "In stock" : "Some items not in stock"}
                onSelect={() => onSelectVendor(q.vendor.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {late.length > 0 ? (
        <div className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
            Would miss the deadline
          </h2>
          <div className="mt-2 flex flex-col gap-3">
            {late.map((q) => (
              <VendorCompareCard
                key={q.vendor.id}
                vendorName={q.vendor.name}
                price={q.totalMonthlyCents}
                eta={q.etaIso}
                deadline={targetIso}
                meetsDeadline={q.meetsDeadline}
                reliability={q.reliability}
                condition={q.condition}
                hoursBadge={q.vendor.openWeekends ? "Open weekends" : "Weekdays only"}
                stockLabel={q.allInStock ? "In stock" : "Some items not in stock"}
                onSelect={() => onSelectVendor(q.vendor.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="text-[16px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          What gets placed
        </h2>
        <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
          {items.length} separate {items.length === 1 ? "order" : "orders"} for {patientName}, one
          per item, each with its own status.
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item) => {
            const price = chosen?.vendor.prices[item.hcpcs];
            return (
              <li key={item.hcpcs} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span>
                  {item.plainName}
                  {item.qty > 1 ? ` × ${item.qty}` : ""}
                </span>
                <span className="shrink-0 font-semibold">
                  {price ? `${formatUsd(perDayCents(price.monthlyCents * item.qty))}/day` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {needsApproval ? (
        <section
          className="mt-4 rounded-[var(--radius-card)] border p-4"
          style={{ background: "var(--burnt-tint)", borderColor: "var(--burnt)" }}
        >
          <h2 className="text-[15px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--burnt-dark)" }}>
            Your DON approves this one first
          </h2>
          <p className="mt-1 text-[14px]">
            {chosen?.overThreshold.map((i) => i.plainName).join(", ")}{" "}
            {chosen && chosen.overThreshold.length === 1 ? "is" : "are"} at or above{" "}
            {formatUsd(donThresholdCents)}, so the vendor is not contacted until the Director of
            Nursing approves. {urgency === "stat" ? "STAT does not skip this." : ""}
          </p>
          <p className="mt-1">
            <AssumedLabel>
              {donThresholdFromSettings
                ? "Threshold set in Settings"
                : "Default threshold — editable in Settings"}
            </AssumedLabel>
          </p>
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-[var(--radius-card)] border p-4"
          style={{ background: "#FBEAE9", borderColor: "var(--red)" }}
        >
          <p className="text-[14px]">{error}</p>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Your choices are still here. Try again.
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <BigActionButton tone="primary" size="lg" onClick={submit} disabled={pending || !chosen}>
          {pending ? "Placing" : needsApproval ? "Send for approval" : "Place order"}
        </BigActionButton>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em]"
        >
          Back
        </button>
      </div>

      <p className="mt-6 text-center">
        <SyntheticLabel>Vendor scores are computed from synthetic order history</SyntheticLabel>
      </p>
    </div>
  );
}
