// N6 — vendor run list. Zero login: the token in the URL is the identity. This page
// never reads brx_role / brx_user; it sits outside the (hospice) group on purpose.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import PollRefresh from "@/components/poll-refresh";
import SkeletonStack from "@/components/skeleton-stack";
import EmptyState from "@/components/empty-state";
import { SyntheticLabel } from "@/components/labels";
import StatusChip from "@/components/status-chip";
import { now } from "@/src/lib/clock";
import { formatDayTime, formatTime } from "@/src/lib/domain";
import type { StopVariant } from "@/src/lib/domain";
import { loadRunList, resolveToken, routeForScope } from "@/src/lib/magic-link";
import type { ResolvedLink, VendorStop } from "@/src/lib/magic-link";
import LinkClosed from "./link-state";
import ShareBar from "./share-bar";

export const dynamic = "force-dynamic";

const VARIANT: Record<StopVariant, { label: string; bg: string; fg: string }> = {
  delivery: { label: "Delivery", bg: "var(--royal-tint)", fg: "#35618A" },
  pickup: { label: "Pickup", bg: "var(--purple-tint)", fg: "var(--purple)" },
  oxygen_swap: { label: "Oxygen swap", bg: "var(--burnt-tint)", fg: "var(--burnt-dark)" },
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Denver",
});

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[var(--radius-badge)] px-2 py-[2px] text-[10.8px] font-bold uppercase tracking-[0.05em]"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

function HazmatChip() {
  return (
    <Chip bg="var(--burnt-tint)" fg="var(--burnt-dark)">
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="currentColor">
        <path d="M8 1.2 15.2 14H0.8L8 1.2Z" />
      </svg>
      Hazmat · oxygen
    </Chip>
  );
}

function windowLine(stop: VendorStop): string {
  if (!stop.windowStart) return "No time set yet";
  if (stop.windowKind === "pickup_window") {
    return stop.windowEnd
      ? `${formatDayTime(stop.windowStart)} – ${formatTime(stop.windowEnd)}`
      : formatDayTime(stop.windowStart);
  }
  if (stop.windowKind === "eta") return `ETA ${formatDayTime(stop.windowStart)}`;
  if (stop.windowKind === "needed_by") return `Needed by ${formatDayTime(stop.windowStart)}`;
  return `Requested ${formatDayTime(stop.windowStart)}`;
}

function lateLine(stop: VendorStop, clock: Date): string | null {
  if (!stop.windowStart) return null;
  const overdueMs = clock.getTime() - Date.parse(stop.windowStart);
  if (overdueMs <= 0) return null;
  const hours = Math.floor(overdueMs / 3_600_000);
  if (hours < 1) return "Past the time the hospice gave.";
  if (hours < 48) return `${hours} hours past the time the hospice gave.`;
  return `${Math.floor(hours / 24)} days past the time the hospice gave.`;
}

function StopRow({
  stop,
  token,
  clock,
}: {
  stop: VendorStop;
  token: string;
  clock: Date;
}) {
  const variant = VARIANT[stop.variant];
  const late = lateLine(stop, clock);
  return (
    <article
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[17px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          {windowLine(stop)}
        </p>
        <Chip bg={variant.bg} fg={variant.fg}>
          {variant.label}
        </Chip>
      </div>

      {late ? (
        <p className="mt-1 text-[13px] font-semibold" style={{ color: "var(--burnt-dark)" }}>
          {late}
        </p>
      ) : null}

      <p className="mt-2 text-[15px]">{stop.address}</p>
      {stop.addressNote ? (
        <p className="text-[13px] text-[var(--ink-soft)]">{stop.addressNote}</p>
      ) : null}
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        {stop.patientLabel} · {stop.hospiceName} · {stop.orderNo}
      </p>

      <ul className="mt-3 m-0 list-none p-0">
        {stop.items.map((item) => (
          <li key={item.hcpcs} className="text-[15px]">
            {item.plainName}
            {item.qty > 1 ? ` ×${item.qty}` : ""}{" "}
            <span className="text-[12px] text-[var(--ink-soft)]">{item.hcpcs}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* Badges are derived upstream by derive.ts and passed in, never inferred here. */}
        <StatusChip status={stop.status} badge={stop.badges[0]} />
        {stop.hazmat ? <HazmatChip /> : null}
      </div>

      {stop.variant === "pickup" && stop.familyNote ? (
        <p className="mt-3 border-l-4 border-[var(--secondary)] bg-[var(--paper-alt)] px-3 py-2 text-[13.5px]">
          {stop.familyNote}
        </p>
      ) : null}

      <Link
        href={`/v/${token}/stop/${stop.orderId}`}
        className="mt-4 flex min-h-[52px] items-center justify-center rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em]"
        style={{ background: "var(--salmon)", color: "#24333F" }}
      >
        Open stop
      </Link>
    </article>
  );
}

async function Stops({ link, clock }: { link: ResolvedLink; clock: Date }) {
  const result = await loadRunList(link, clock);
  if (!result.ok) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-[15px]">We couldn&rsquo;t load your stops just now.</p>
        <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
          The link is fine. This page checks again every few seconds.
        </p>
      </div>
    );
  }

  const { stops, source } = result.data;
  if (stops.length === 0) {
    return <EmptyState message="No stops today." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {source === "fixture" ? (
        <p className="text-[12px] text-[var(--ink-soft)]">
          Sample stops — this environment has no database connection.
        </p>
      ) : null}
      {stops.map((stop) => (
        <StopRow key={stop.orderId} stop={stop} token={link.token} clock={clock} />
      ))}
    </div>
  );
}

export default async function VendorRunListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const clock = await now();
  const resolved = await resolveToken(token, clock);

  if (resolved.status !== "ok") return <LinkClosed status={resolved.status} />;
  const { link } = resolved;
  if (link.scope !== "run_list") {
    redirect(routeForScope(link.scope, link.token, link.orderId));
  }

  return (
    <section>
      <PollRefresh intervalMs={5000} />

      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {link.vendor.name}
      </p>
      <h1
        className="mt-1 text-[24px] leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Your stops
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        {DATE_FMT.format(clock)} · earliest first
      </p>

      <div className="mt-4">
        <ShareBar hint="Send this link to whoever is driving. It keeps working — no login, no app." />
      </div>

      <div className="mt-4">
        <Suspense fallback={<SkeletonStack rows={3} height={190} />}>
          <Stops link={link} clock={clock} />
        </Suspense>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
        <Link
          href={`/v/${link.token}/scorecard`}
          className="text-[14px] font-semibold"
          style={{ color: "var(--burnt-dark)" }}
        >
          See your report card
        </Link>
        <Link
          href={`/v/${link.token}/welcome`}
          className="text-[14px] font-semibold"
          style={{ color: "var(--burnt-dark)" }}
        >
          Update what you carry
        </Link>
        <p className="mt-2">
          <SyntheticLabel>Synthetic patients and addresses</SyntheticLabel>
        </p>
      </div>
    </section>
  );
}
