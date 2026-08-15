"use client";

import ApprovalInterstitial from "@/components/approval-interstitial";
import BigActionButton from "@/components/big-action-button";
import ConditionAckSheet from "@/components/condition-ack-sheet";
import EmptyState from "@/components/empty-state";
import ErrorState from "@/components/error-state";
import EventTimeline from "@/components/event-timeline";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import MessageBubble from "@/components/message-bubble";
import ParsedInterpretation from "@/components/parsed-interpretation";
import RiskBanner from "@/components/risk-banner";
import SkeletonStack from "@/components/skeleton-stack";
import StatusChip from "@/components/status-chip";
import StopCard from "@/components/stop-card";
import VendorCompareCard from "@/components/vendor-compare-card";
import { EVENT_TYPES, ORDER_STATUSES } from "@/src/lib/domain";
import type { TimelineEvent } from "@/src/lib/domain";

const BASE = Date.parse("2026-08-14T13:00:00-04:00");
const at = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString();

const TIMELINE: TimelineEvent[] = [
  ...EVENT_TYPES.map((type, i) => ({
    id: `e${i}`,
    type,
    at: at(i * 7),
    actor: i % 3 === 0 ? "Dana R., case manager" : "Ridgeline Medical Supply",
  })),
  {
    id: "msg-out",
    type: "message_sent",
    at: at(200),
    actor: "Agent",
    message: {
      direction: "outbound" as const,
      body: "Hospital bed for the Alvarez home still on for 2:00 PM?",
      who: "BetterRX",
    },
  },
  {
    id: "msg-in",
    type: "message_received",
    at: at(206),
    actor: "Ridgeline dispatch",
    message: {
      direction: "inbound" as const,
      body: "running behind, 95 is a mess. more like 4ish",
      who: "Ridgeline dispatch",
    },
    parsed: { line: "delayed ~2h, reason: traffic", confidence: 0.86 },
  },
  {
    id: "msg-in-low",
    type: "message_received",
    at: at(212),
    actor: "Ridgeline dispatch",
    message: {
      direction: "inbound" as const,
      body: "maybe. driver said something about the bridge",
      who: "Ridgeline dispatch",
    },
    parsed: { line: "possible delay, no new ETA given", confidence: 0.41 },
  },
  {
    id: "unknown",
    type: "future_event",
    at: at(220),
    detail: "Unknown event type renders its raw string instead of crashing.",
  },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2
        className="text-[18px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {title}
      </h2>
      {note ? (
        <p className="mb-3 text-[13px] text-[var(--ink-soft)]">{note}</p>
      ) : (
        <div className="mb-3" />
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function ComponentFixturesPage() {
  return (
    <main className="mx-auto max-w-[390px] px-4 py-6">
      <h1
        className="text-[24px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Component fixtures — dev only
      </h1>
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        Hardcoded props. No data fetching, no writes.
      </p>

      <Section title="StatusChip" note="All six statuses, both derived badges.">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((status) => (
            <StatusChip key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip status="in_transit" badge="AT_RISK" />
          <StatusChip status="pickup_triggered" badge="PICKUP_DELAYED" />
          <StatusChip status="ordered" awaitingApproval />
        </div>
      </Section>

      <Section
        title="VendorCompareCard"
        note="Per-day cost, ETA-vs-deadline track, unrated never renders 0."
      >
        <VendorCompareCard
          vendorName="Ridgeline Medical Supply"
          price={24000}
          eta={at(60)}
          deadline={at(120)}
          meetsDeadline
          reliability={94}
          condition={88}
          hoursBadge="Open Sundays"
          stockLabel="In stock"
          selected
        />
        <VendorCompareCard
          vendorName="Cardinal Home Medical"
          price={19500}
          eta={at(170)}
          deadline={at(120)}
          meetsDeadline={false}
          reliability={71}
          condition={65}
          hoursBadge="Weekdays only"
          stockLabel="Low stock"
        />
        <VendorCompareCard
          vendorName="Beacon DME (new contract)"
          price={21000}
          eta={at(95)}
          deadline={at(120)}
          meetsDeadline
          reliability="unrated"
          condition="unrated"
          stockLabel="In stock"
        />
        <VendorCompareCard
          vendorName="No deadline set"
          price={21000}
          eta={at(95)}
          meetsDeadline
          reliability={80}
          condition={80}
        />
      </Section>

      <Section
        title="EventTimeline"
        note="All 23 event types, message bubbles, parsed lines, plus one unknown type."
      >
        <EventTimeline events={TIMELINE} highlightId="e16" />
        <EventTimeline events={[]} />
      </Section>

      <Section title="MessageBubble + ParsedInterpretation">
        <div>
          <MessageBubble
            direction="outbound"
            body="Confirming pickup for the Alvarez home."
            who="BetterRX"
            at="2:14 AM"
          />
          <MessageBubble
            direction="inbound"
            body="got it, tuesday after the service"
            who="Ridgeline dispatch"
            at="2:21 AM"
          />
          <ParsedInterpretation line="pickup Tue, family requested" confidence={0.91} />
          <ParsedInterpretation line="unclear day, needs a person" confidence={0.38} />
        </div>
      </Section>

      <Section title="StopCard" note="Three variants, compact and full, hazmat on and off.">
        <StopCard
          variant="delivery"
          hazmat={false}
          orderNo="DME-10305"
          patientLabel="Marta A."
          address="418 Kessler Ave, Apt 3B"
          windowLabel="1:00–3:00 PM"
          items={[
            { hcpcs: "E0260", plainName: "Hospital bed" },
            { hcpcs: "E0277", plainName: "Pressure mattress" },
          ]}
        />
        <StopCard
          variant="delivery"
          hazmat
          mode="full"
          orderNo="DME-10307"
          patientLabel="Howard L."
          address="1290 Fenmore Rd"
          addressNote="Side door. Dog is friendly but loud."
          windowLabel="3:30–5:00 PM"
          items={[{ hcpcs: "E0431", plainName: "Portable oxygen cylinder", qty: 2 }]}
        />
        <StopCard
          variant="pickup"
          hazmat={false}
          orderNo="DME-09911"
          patientLabel="Alvarez home"
          address="77 Wilbur St"
          windowLabel="Tue 10:00 AM"
          items={[{ hcpcs: "E0260", plainName: "Hospital bed" }]}
          familyNote="Family asked for Tuesday, after the service."
        />
        <StopCard
          variant="pickup"
          hazmat={false}
          mode="full"
          orderNo="DME-09803"
          patientLabel="Nguyen home"
          address="12 Palmer Ct"
          windowLabel="Overdue 3 days"
          items={[
            { hcpcs: "E0143", plainName: "Walker" },
            { hcpcs: "E0163", plainName: "Bedside commode" },
          ]}
        />
        <StopCard
          variant="oxygen_swap"
          hazmat
          mode="full"
          orderNo="DME-10422"
          patientLabel="Rosen home"
          address="9 Larkspur Ln"
          windowLabel="9:00–11:00 AM"
          items={[{ hcpcs: "E0431", plainName: "Portable oxygen cylinder", qty: 4 }]}
        />
      </Section>

      <Section title="BigActionButton" note="xl is at least 64px tall.">
        <BigActionButton size="xl" tone="primary">
          Order equipment
        </BigActionButton>
        <BigActionButton size="xl" tone="slate">
          Patient status change
        </BigActionButton>
        <BigActionButton size="lg" tone="primary">
          Place order
        </BigActionButton>
        <BigActionButton size="lg" tone="slate">
          Call vendor
        </BigActionButton>
        <BigActionButton size="lg" tone="quiet">
          Go back
        </BigActionButton>
        <BigActionButton size="lg" tone="primary" disabled>
          Place order
        </BigActionButton>
      </Section>

      <Section title="ConditionAckSheet" note="Non-None reveals the optional photo slot.">
        <ConditionAckSheet itemLabel="Hospital bed · E0260" />
        <ConditionAckSheet itemLabel="Hospital bed · E0260" defaultValue="none" />
        <ConditionAckSheet itemLabel="Pressure mattress · E0277" defaultValue="damaged" />
      </Section>

      <Section title="ApprovalInterstitial">
        <ApprovalInterstitial
          orderNo="DME-10309"
          vendorName="Ridgeline Medical Supply"
          price={24000}
          cheapestPrice={19500}
          cheapestVendorName="Cardinal Home Medical"
          approverName="Priya S., DON"
        />
      </Section>

      <Section title="RiskBanner" note="Reason is always on screen.">
        <RiskBanner
          reason="ETA 5:10 PM vs discharge 4:30 PM. Misses by 40 minutes."
          timeLeft="6 hours to fix"
          actionLabel="See options"
          actionHref="/orders/DME-10305?sheet=escalate"
        />
        <RiskBanner
          title="Pickup delayed"
          reason="Requested 3 days ago. No pickup scheduled. Rental billing is still running."
          timeLeft="Day 3"
          actionLabel="Nudge vendor"
          updatedJustNow
        />
      </Section>

      <Section title="Labels">
        <div className="flex flex-wrap gap-3">
          <SyntheticLabel />
          <AssumedLabel />
          <AssumedLabel>Assumed 4-hour window</AssumedLabel>
        </div>
      </Section>

      <Section title="EmptyState · ErrorState · SkeletonStack">
        <EmptyState
          message="No equipment in this home yet."
          actionLabel="Order equipment"
          actionHref="#"
        />
        <EmptyState message="No stops today." />
        <ErrorState />
        <ErrorState message="We couldn't notify the vendors. Try again." />
        <SkeletonStack rows={3} />
      </Section>

      <Section
        title="PollRefresh"
        note="Client component, renders nothing. Not mounted here — it would refresh this page every few seconds."
      >
        <p className="text-[13.5px] text-[var(--ink-soft)]">
          {'<PollRefresh intervalMs={5000} />'}
        </p>
      </Section>
    </main>
  );
}
