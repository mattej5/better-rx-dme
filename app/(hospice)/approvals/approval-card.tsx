"use client";

import { useState, useTransition } from "react";
import { approveOrder, denyOrder, type ApprovalActionState } from "@/app/actions/approvals";
import { AssumedLabel } from "@/components/labels";
import StatusChip from "@/components/status-chip";
import { formatUsd, perDayCents } from "@/src/lib/domain";
import type { ApprovalCardData } from "./data";

function AlternativeLine({ card }: { card: ApprovalCardData }) {
  if (!card.alternative || card.monthlyPriceCents === null) return null;
  const difference = perDayCents(card.monthlyPriceCents) - perDayCents(card.alternative.monthlyPriceCents);
  const comparison = difference === 0
    ? `Same daily price as ${card.alternative.vendorName}`
    : `${formatUsd(Math.abs(difference))}/day ${difference > 0 ? "more" : "less"} than ${card.alternative.vendorName}`;
  return (
    <p className="mt-2 text-[13px] text-ink-soft">
      {comparison} <AssumedLabel>Estimated as monthly price ÷ 30</AssumedLabel>
    </p>
  );
}

export default function ApprovalCard({ card, canAct }: { card: ApprovalCardData; canAct: boolean }) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ApprovalActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setResult(null);
    startTransition(async () => setResult(await approveOrder(card.orderId)));
  }

  function deny() {
    setResult(null);
    startTransition(async () => setResult(await denyOrder(card.orderId, reason)));
  }

  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-bold" style={{ fontFamily: "var(--font-display)" }}>{card.patientName}</p>
          <p className="mt-0.5 text-[12px] text-ink-soft">Order {card.orderNo}</p>
        </div>
        <StatusChip status="ordered" awaitingApproval />
      </div>

      <ul className="mt-4 space-y-1">
        {card.items.length ? card.items.map((item) => (
          <li key={item.hcpcs} className="text-[15px] font-semibold">
            {item.qty > 1 ? `${item.qty} × ` : ""}{item.plainName}
            <span className="ml-2 text-[11px] font-normal text-ink-soft">{item.hcpcs}</span>
          </li>
        )) : <li className="text-[14px] text-ink-soft">Equipment details unavailable</li>}
      </ul>

      <div className="mt-4 border-t border-[var(--line)] pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">{card.vendorName}</p>
            <p className="mt-1 text-[12px] text-ink-soft">
              Approval limit {formatUsd(perDayCents(card.thresholdCents))}/day <AssumedLabel />
            </p>
          </div>
          <div className="text-right">
            {card.monthlyPriceCents === null ? (
              <p className="text-[13px] text-ink-soft">Price unavailable</p>
            ) : (
              <>
                <p className="text-[20px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {formatUsd(perDayCents(card.monthlyPriceCents))}<span className="text-[13px] font-medium">/day total</span>
                </p>
              </>
            )}
            <AssumedLabel>Monthly rental price</AssumedLabel>
          </div>
        </div>
        <AlternativeLine card={card} />
      </div>

      {canAct ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={approve} disabled={pending} className="min-h-[48px] rounded-[var(--radius-btn)] bg-[var(--salmon)] px-3 text-[13px] font-extrabold uppercase disabled:opacity-50">APPROVE</button>
            <button type="button" onClick={() => setShowReason(true)} disabled={pending} className="min-h-[48px] rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--paper-alt)] px-3 text-[13px] font-extrabold uppercase disabled:opacity-50">DENY ORDER</button>
          </div>
          {showReason ? (
            <div className="mt-3 rounded-[var(--radius-card)] bg-[var(--paper-alt)] p-3">
              <label htmlFor={`reason-${card.orderId}`} className="text-[12px] font-bold uppercase tracking-[0.05em]">Reason for nurse</label>
              <textarea id={`reason-${card.orderId}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-2 w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-white p-3 text-[14px]" />
              <button type="button" onClick={deny} disabled={pending || !reason.trim()} className="mt-2 min-h-[44px] w-full rounded-[var(--radius-btn)] bg-[var(--ink)] px-3 text-[13px] font-extrabold uppercase text-white disabled:opacity-50">DENY ORDER</button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-[var(--radius-card)] bg-[var(--paper-alt)] p-3 text-[13px] text-ink-soft">Only the Director of Nursing can approve or deny this order.</p>
      )}
      {result ? <p role="status" className={`mt-3 text-[13px] font-semibold ${result.ok ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{result.message}</p> : null}
    </article>
  );
}
