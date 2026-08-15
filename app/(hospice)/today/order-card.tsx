import Link from "next/link";
import StatusChip from "@/components/status-chip";
import type { Badge, OrderStatus } from "@/src/lib/domain";

export type OrderCardProps = {
  href: string;
  patientName: string;
  itemLine: string;
  whenLine?: string;
  vendorName?: string | null;
  status: OrderStatus;
  /** From derive.ts upstream. Never inferred here. */
  badge?: Badge;
  awaitingApproval?: boolean;
  reason?: string;
};

export default function OrderCard({
  href,
  patientName,
  itemLine,
  whenLine,
  vendorName,
  status,
  badge,
  awaitingApproval,
  reason,
}: OrderCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={badge ? { borderColor: "var(--red)" } : undefined}
    >
      <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
        {patientName}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-[var(--ink)]">
        {itemLine}
      </p>
      {whenLine ? (
        <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{whenLine}</p>
      ) : null}
      {vendorName ? (
        <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
          {vendorName}
        </p>
      ) : null}
      <div className="mt-2">
        <StatusChip
          status={status}
          badge={badge}
          awaitingApproval={awaitingApproval}
        />
      </div>
      {badge && reason ? (
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{reason}</p>
      ) : null}
    </Link>
  );
}
