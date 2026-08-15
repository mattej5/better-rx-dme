import Link from "next/link";
import ApprovalInterstitial from "@/components/approval-interstitial";
import EmptyState from "@/components/empty-state";
import StatusChip from "@/components/status-chip";
import { awaitingApproval } from "@/src/lib/derive";
import { formatDayTime, type OrderStatus } from "@/src/lib/domain";
import { hasSupabaseEnv } from "../../../patients/data";

export const dynamic = "force-dynamic";

type Line = {
  id: string;
  orderNo: string;
  plainName: string;
  status: OrderStatus;
  awaiting: boolean;
  priceCents: number | null;
  targetAt: string | null;
  hcpcs: string | null;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function itemOf(items: unknown): { hcpcs: string; plainName: string } | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0];
  if (!first || typeof first !== "object") return null;
  const rec = first as Record<string, unknown>;
  if (typeof rec.hcpcs !== "string") return null;
  return {
    hcpcs: rec.hcpcs,
    plainName: typeof rec.plain_name === "string" ? rec.plain_name : rec.hcpcs,
  };
}

export default async function OrderSubmittedPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const ids = (firstValue(query.ids) ?? "").split(",").filter(Boolean);

  const heading = (
    <h1 className="text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
      Order placed
    </h1>
  );

  if (ids.length === 0 || !hasSupabaseEnv()) {
    return (
      <section>
        {heading}
        <div className="mt-4">
          <EmptyState
            message={
              hasSupabaseEnv()
                ? "We couldn't find those orders."
                : "Not connected to the database, so no order was written."
            }
            actionLabel="Back to patient"
            actionHref={`/patients/${patientId}`}
          />
        </div>
      </section>
    );
  }

  const { supabase } = await import("@/src/lib/supabase");
  const [ordersRes, eventsRes] = await Promise.all([
    supabase.from("orders").select("*").in("id", ids),
    supabase.from("order_events").select("*").in("order_id", ids).order("created_at", { ascending: true }),
  ]);

  if (ordersRes.error || !ordersRes.data || ordersRes.data.length === 0) {
    return (
      <section>
        {heading}
        <div className="mt-4">
          <EmptyState
            message="We couldn't load the orders you just placed."
            actionLabel="Back to patient"
            actionHref={`/patients/${patientId}`}
          />
        </div>
      </section>
    );
  }

  const eventsByOrder = new Map<string, { type: string }[]>();
  for (const e of eventsRes.data ?? []) {
    const list = eventsByOrder.get(e.order_id) ?? [];
    list.push(e);
    eventsByOrder.set(e.order_id, list);
  }

  const lines: Line[] = ordersRes.data.map((order) => {
    const item = itemOf(order.items);
    return {
      id: order.id,
      orderNo: order.order_no,
      plainName: item?.plainName ?? order.order_no,
      hcpcs: item?.hcpcs ?? null,
      status: order.status,
      awaiting: awaitingApproval(eventsByOrder.get(order.id) ?? []),
      priceCents: order.price_cents,
      targetAt: order.target_at,
    };
  });

  const vendorId = ordersRes.data[0].vendor_id;
  const vendorRes = vendorId
    ? await supabase.from("vendors").select("name").eq("id", vendorId).maybeSingle()
    : null;
  const vendorName = vendorRes?.data?.name ?? "the vendor";

  const firstAwaiting = lines.find((l) => l.awaiting);
  let cheapest: { name: string; priceCents: number } | null = null;
  if (firstAwaiting?.hcpcs) {
    const alt = await supabase
      .from("vendor_prices")
      .select("price_cents, vendors(name)")
      .eq("hcpcs", firstAwaiting.hcpcs)
      .order("price_cents", { ascending: true })
      .limit(1)
      .maybeSingle();
    const vendorField = alt.data?.vendors as { name: string } | { name: string }[] | null | undefined;
    const name = Array.isArray(vendorField) ? vendorField[0]?.name : vendorField?.name;
    if (alt.data && name) cheapest = { name, priceCents: alt.data.price_cents };
  }

  return (
    <section>
      {firstAwaiting ? (
        <ApprovalInterstitial
          vendorName={vendorName}
          price={firstAwaiting.priceCents ?? 0}
          cheapestPrice={cheapest?.priceCents ?? firstAwaiting.priceCents ?? 0}
          cheapestVendorName={cheapest?.name ?? vendorName}
          orderNo={firstAwaiting.orderNo}
        />
      ) : (
        <>
          {heading}
          <p className="mt-1 text-[15px]">
            {vendorName} has been texted.{" "}
            {lines[0].targetAt
              ? `Needed by ${formatDayTime(lines[0].targetAt)}.`
              : ""}
          </p>
        </>
      )}

      <ul className="mt-5 flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line.id}>
            <Link
              href={`/orders/${line.id}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold leading-tight">
                  {line.plainName}
                </span>
                <span className="block text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                  {line.orderNo}
                </span>
              </span>
              <StatusChip status={line.status} awaitingApproval={line.awaiting} />
            </Link>
          </li>
        ))}
      </ul>

      {lines.length > 1 ? (
        <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
          {lines.length} separate orders, placed together. Each one tracks on its own.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href={`/patients/${patientId}`}
          className="flex min-h-[48px] items-center justify-center rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em]"
          style={{ background: "var(--salmon)", color: "#24333F" }}
        >
          Back to patient
        </Link>
        <Link
          href="/today"
          className="flex min-h-[48px] items-center justify-center rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em]"
        >
          Go to today
        </Link>
      </div>
    </section>
  );
}
