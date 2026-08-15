import Link from "next/link";
import StatusChip from "@/components/status-chip";
import type { Badge, OrderStatus } from "@/src/lib/domain";

export type EquipmentRowProps = {
  orderId: string;
  plainName: string;
  hcpcs: string;
  qty?: number;
  status: OrderStatus;
  badge?: Badge;
  awaitingApproval?: boolean;
  resupplyDue?: string;
  /** Set when badge is PICKUP_DELAYED — days since pickup was requested. */
  pickupElapsedDays?: number;
};

export default function EquipmentRow({
  orderId,
  plainName,
  hcpcs,
  qty,
  status,
  badge,
  awaitingApproval,
  resupplyDue,
  pickupElapsedDays,
}: EquipmentRowProps) {
  const delayed = badge === "PICKUP_DELAYED";
  return (
    <Link
      href={`/orders/${orderId}`}
      className="block rounded-[var(--radius-card)] border p-4"
      style={{
        background: delayed ? "var(--red-tint)" : "var(--surface)",
        borderColor: delayed ? "var(--red)" : "var(--line)",
      }}
    >
      <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
        {plainName}
        {qty && qty > 1 ? (
          <span className="font-normal text-[var(--ink-soft)]"> ×{qty}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[12px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        {hcpcs}
      </p>
      <div className="mt-2">
        <StatusChip
          status={status}
          badge={badge}
          awaitingApproval={awaitingApproval}
        />
      </div>
      {delayed && pickupElapsedDays !== undefined ? (
        <p className="mt-2 text-[13px] font-semibold" style={{ color: "#B4322A" }}>
          {pickupElapsedDays} {pickupElapsedDays === 1 ? "day" : "days"} since
          pickup was requested
        </p>
      ) : null}
      {resupplyDue ? (
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
          Resupply due {resupplyDue}
        </p>
      ) : null}
    </Link>
  );
}
