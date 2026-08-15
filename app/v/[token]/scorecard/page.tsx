// N12 — vendor report card. Scores come from src/lib/derive.ts (engine lane) and are
// never recomputed here; this page only formats what those pure functions return.
// The proof pack is a READ-ONLY list of delivered / picked_up events. No PDF.
import { Suspense } from "react";
import Link from "next/link";

import SkeletonStack from "@/components/skeleton-stack";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { MIN_ORDERS_FOR_SCORE } from "@/src/lib/derive";
import type { ScoreBreakdown, ScoreResult } from "@/src/lib/derive";
import { loadScorecard, resolveToken } from "@/src/lib/magic-link";
import type { ProofEntry, ResolvedLink } from "@/src/lib/magic-link";
import LinkClosed from "../link-state";

export const dynamic = "force-dynamic";

/** One deterministic tip per scored variable. No model, no personalization. */
const TIPS: Record<string, string> = {
  on_time: "Deliver before the hospice's needed-by time, not before your own ETA.",
  pickup_timeliness:
    "Collect within 24 hours of the pickup text. Batching a run inside that window does not count against you.",
  confirmation: "Reply to the first text with YES or a time. Median reply time is what counts.",
  at_risk_freq: "Send an ETA early. An order goes at risk when nobody has heard from you.",
  eta_accuracy: "Give the time you can hit, not the time you hope for.",
  decline_behavior:
    "If you can't take a job, say so in the first hour. An early no costs a quarter of a late one.",
  functional: "Test every unit before it leaves the warehouse.",
  clean: "Sanitize and wrap before loading.",
  repair: "Retire worn frames and mattresses instead of rotating them back out.",
  defect_swap: "Each defect swap is a second trip. Bench-check high-use items first.",
  post_delivery_issues:
    "Problems found days later usually trace back to a skipped pre-delivery check.",
};

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Denver",
});

function weightPct(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

function weakest(breakdown: ScoreBreakdown[]): ScoreBreakdown | null {
  const measured = breakdown.filter((row) => row.value !== null);
  if (measured.length === 0) return null;
  return measured.reduce((low, row) =>
    (row.value as number) < (low.value as number) ? row : low,
  );
}

function ScoreRow({ row }: { row: ScoreBreakdown }) {
  const measured = row.value !== null;
  const tip = TIPS[row.key];
  return (
    <li className="border-t border-[var(--line-soft)] py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px]">{row.label}</span>
        <span className="shrink-0 text-[14px] font-semibold">
          {measured ? row.value : "Not measured yet"}
          <span className="ml-2 text-[12px] font-normal text-[var(--ink-soft)]">
            × {weightPct(row.weight)}
          </span>
        </span>
      </div>
      <p className="text-[12px] text-[var(--ink-soft)]">
        {measured ? `From ${row.n} order${row.n === 1 ? "" : "s"}` : "Left out of the total"}
      </p>
      {measured && (row.value as number) < 80 && tip ? (
        <p className="mt-1 text-[13px]" style={{ color: "var(--burnt-dark)" }}>
          {tip}
        </p>
      ) : null}
    </li>
  );
}

function ScoreBlock({
  title,
  question,
  result,
}: {
  title: string;
  question: string;
  result: ScoreResult;
}) {
  const rated = result.score !== null;
  const worst = weakest(result.breakdown);
  const measuredWeight = result.breakdown
    .filter((row) => row.value !== null)
    .reduce((sum, row) => sum + row.weight, 0);

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            className="m-0 text-[17px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            {title}
          </h2>
          <p className="text-[13px] text-[var(--ink-soft)]">{question}</p>
        </div>
        <p
          className="shrink-0 text-[38px] leading-none"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          {rated ? result.score : "Unrated"}
        </p>
      </div>

      {!rated ? (
        <p className="mt-2 text-[13.5px] text-[var(--ink-soft)]">
          We publish a score after {MIN_ORDERS_FOR_SCORE} finished orders. You have{" "}
          {result.n_orders}. Nothing is hidden, there just isn&rsquo;t enough to measure yet.
        </p>
      ) : null}

      <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        How this number is built
      </p>
      <ul className="m-0 mt-1 list-none p-0">
        {result.breakdown.map((row) => (
          <ScoreRow key={row.key} row={row} />
        ))}
      </ul>

      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-soft)]">
        {measuredWeight > 0 ? (
          <>
            Score = each part × its weight, divided by the weights we could measure (
            {weightPct(measuredWeight)} of {weightPct(1)}). {result.n_orders} order
            {result.n_orders === 1 ? "" : "s"} counted.{" "}
          </>
        ) : (
          <>Nothing measurable yet, so no part carries weight. </>
        )}
        A dispute you win drops out of the math entirely.
      </p>

      {rated && worst ? (
        <p className="mt-3 rounded-[8px] bg-[var(--paper-alt)] px-3 py-2 text-[13.5px]">
          <span className="font-semibold">Fix first: {worst.label.toLowerCase()}.</span>{" "}
          {TIPS[worst.key] ?? "Keep an eye on this one."}
        </p>
      ) : null}
    </section>
  );
}

function ProofRow({ entry }: { entry: ProofEntry }) {
  return (
    <li className="border-t border-[var(--line-soft)] py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-semibold">
          {entry.kind === "delivered" ? "Delivered" : "Picked up"}
        </span>
        <span className="shrink-0 text-[13px] text-[var(--ink-soft)]">
          {TIME_FMT.format(new Date(entry.at))}
        </span>
      </div>
      <p className="text-[13px] text-[var(--ink-soft)]">
        {entry.orderNo} · {entry.patientLabel}
      </p>
      <p className="text-[13px]">
        {entry.signature ? `Signed by ${entry.signature}` : "No signature captured"}
        {entry.photoUrl ? (
          <>
            {" · "}
            <a
              href={entry.photoUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--burnt-dark)" }}
              className="font-semibold"
            >
              Photo
            </a>
          </>
        ) : (
          " · No photo"
        )}
      </p>
    </li>
  );
}

async function Card({ link, clock }: { link: ResolvedLink; clock: Date }) {
  const result = await loadScorecard(link, clock);
  if (!result.ok) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <p className="text-[15px]">We couldn&rsquo;t load your report card just now.</p>
        <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
          The link is fine. Open it again in a moment.
        </p>
      </div>
    );
  }

  const card = result.data;
  return (
    <div className="flex flex-col gap-4">
      {card.source === "fixture" ? (
        <p className="text-[12px] text-[var(--ink-soft)]">
          Sample history. This environment has no database connection.
        </p>
      ) : null}

      <div className="flex gap-3">
        <div className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
            Orders won
          </p>
          <p
            className="mt-1 text-[26px] leading-none"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            {card.ordersWon}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Times this hospice picked you
          </p>
        </div>
        <div className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
            Finished
          </p>
          <p
            className="mt-1 text-[26px] leading-none"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            {card.ordersDelivered}
          </p>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Delivered or collected</p>
        </div>
      </div>

      <ScoreBlock
        title="Reliability"
        question="Did it happen on time?"
        result={card.reliability}
      />
      <ScoreBlock
        title="Condition"
        question="What showed up at the house?"
        result={card.condition}
      />

      <section
        className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
        style={{ boxShadow: "var(--shadow)" }}
      >
        <h2
          className="m-0 text-[17px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Proof pack
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Every delivery and pickup you signed off, with the photo and signature your
          driver captured. Read-only. This is the record, not a report.
        </p>
        {card.proof.length === 0 ? (
          <p className="mt-3 text-[14px]">Nothing signed off yet.</p>
        ) : (
          <ul className="m-0 mt-2 list-none p-0">
            {card.proof.map((entry) => (
              <ProofRow key={`${entry.orderId}-${entry.kind}-${entry.at}`} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function VendorScorecardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const clock = await now();
  const resolved = await resolveToken(token, clock);
  if (resolved.status !== "ok") return <LinkClosed status={resolved.status} />;
  const { link } = resolved;

  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {link.vendor.name}
      </p>
      <h1
        className="mt-1 text-[24px] leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Your report card
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        Built from the delivery record, not from opinions. Every part of the math is on
        this page.
      </p>

      <div className="mt-4">
        <Suspense fallback={<SkeletonStack rows={3} height={180} />}>
          <Card link={link} clock={clock} />
        </Suspense>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
        <Link
          href={`/v/${link.token}`}
          className="text-[14px] font-semibold"
          style={{ color: "var(--burnt-dark)" }}
        >
          Back to your stops
        </Link>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <SyntheticLabel>Synthetic delivery history</SyntheticLabel>
          <AssumedLabel>Weights and cutoffs are defaults</AssumedLabel>
        </p>
      </div>
    </section>
  );
}
