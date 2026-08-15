// N7 — stop card detail. Views 17/18: delivery, pickup, and the oxygen swap
// (one stop, both halves). Zero login: the token in the URL is the identity.
import Link from "next/link";

import PollRefresh from "@/components/poll-refresh";
import LinkClosed from "../../link-state";
import { loadStopDetail } from "./data";
import StopFlow from "./stop-flow";

export const dynamic = "force-dynamic";

export default async function VendorStopPage({
  params,
}: {
  params: Promise<{ token: string; orderId: string }>;
}) {
  const { token, orderId } = await params;
  const result = await loadStopDetail(token, orderId);

  if (!result.ok) {
    if (result.kind === "expired") return <LinkClosed status="expired" />;
    if (result.kind === "link_closed") return <LinkClosed status="unknown" />;
    return (
      <section>
        <Link
          href={`/v/${token}`}
          className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]"
        >
          Back to your stops
        </Link>
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-[15px]">
            {result.kind === "not_found"
              ? "This stop is no longer on your list."
              : "We couldn't load this stop just now."}
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
            Your link still works. Go back and open it again.
          </p>
        </div>
      </section>
    );
  }

  const stop = result.data;

  return (
    <section>
      <PollRefresh intervalMs={5000} />

      <Link
        href={`/v/${token}`}
        className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]"
      >
        Back to your stops
      </Link>

      <h1
        className="mt-2 text-[24px] leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {stop.variant === "pickup"
          ? "Pickup"
          : stop.variant === "oxygen_swap"
            ? "Oxygen swap"
            : "Delivery"}
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        {stop.orderNo} · {stop.vendorName}
      </p>

      <div className="mt-4">
        <StopFlow stop={stop} />
      </div>
    </section>
  );
}
