"use client";

import { AssumedLabel } from "@/components/labels";
import { ORDER_URGENCIES, URGENCY_LABEL, formatDayTime, type OrderUrgency } from "@/src/lib/domain";
import { toIso, toLocalInputValue } from "./draft";

const URGENCY_COPY: Record<OrderUrgency, string> = {
  admission: "Setting up a home for a new patient.",
  routine: "Needed soon. Not today.",
  stat: "Needed today. The patient is waiting on it.",
};

type Chip = { label: string; at: Date };

function quickChips(now: Date): Chip[] {
  const inFour = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);
  const tomorrowAfternoon = new Date(now);
  tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
  tomorrowAfternoon.setHours(14, 0, 0, 0);
  return [
    { label: "In 4 hours", at: inFour },
    { label: "Tomorrow 9 AM", at: tomorrowMorning },
    { label: "Tomorrow 2 PM", at: tomorrowAfternoon },
  ];
}

export default function WhenStep({
  urgency,
  targetAt,
  reason,
  leadTimeHours,
  fastestHours,
  nowIso,
  onUrgency,
  onTargetAt,
  onReason,
  onBack,
  onNext,
}: {
  urgency: OrderUrgency | null;
  targetAt: string;
  reason: string;
  leadTimeHours: Record<OrderUrgency, number>;
  /** Fastest a single vendor could bring every chosen item, in hours. */
  fastestHours: number | null;
  nowIso: string;
  onUrgency: (value: OrderUrgency) => void;
  onTargetAt: (value: string) => void;
  onReason: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const now = new Date(nowIso);
  const targetIso = toIso(targetAt);
  const chips = quickChips(now);

  return (
    <div className="pb-[92px]">
      <h1 className="text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
        When is it needed?
      </h1>

      <div className="mt-4 flex flex-col gap-2">
        {ORDER_URGENCIES.map((value) => {
          const on = urgency === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onUrgency(value)}
              aria-pressed={on}
              className="w-full rounded-[var(--radius-card)] border p-4 text-left"
              style={{
                background: on ? "var(--taupe)" : "var(--surface)",
                borderColor: on ? "var(--burnt)" : "var(--line)",
                borderWidth: on ? 2 : 1,
                boxShadow: "var(--shadow)",
                minHeight: 76,
              }}
            >
              <span className="block text-[18px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                {URGENCY_LABEL[value]}
              </span>
              <span className="mt-0.5 block text-[13.5px] text-[var(--ink-soft)]">
                {URGENCY_COPY[value]}
              </span>
              <span className="mt-1 block text-[12px] text-[var(--ink-soft)]">
                Vendors usually need {leadTimeHours[value]} hours. <AssumedLabel>Assumed</AssumedLabel>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <label
          htmlFor="target-at"
          className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]"
        >
          Needed by
        </label>
        <input
          id="target-at"
          type="datetime-local"
          value={targetAt}
          onChange={(e) => onTargetAt(e.target.value)}
          className="mt-1 min-h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onTargetAt(toLocalInputValue(chip.at))}
              className="min-h-[40px] rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-semibold"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {fastestHours !== null ? (
        <p className="mt-3 text-[13px] text-[var(--ink-soft)]">
          The soonest anyone can bring everything on this order is{" "}
          {formatDayTime(new Date(now.getTime() + fastestHours * 3_600_000).toISOString())}.{" "}
          <AssumedLabel>Based on stated vendor lead times</AssumedLabel>
        </p>
      ) : null}

      <p className="mt-4 text-[16px]" aria-live="polite">
        {urgency && targetIso ? (
          <>
            <span className="font-semibold">
              {urgency === "admission" ? "Must arrive before the patient gets home, " : "Must arrive by "}
              {formatDayTime(targetIso)}.
            </span>{" "}
            <span className="text-[var(--ink-soft)]">
              {URGENCY_LABEL[urgency]} order.
            </span>
          </>
        ) : (
          <span className="text-[var(--ink-soft)]">
            Pick how urgent it is and the time it has to be there.
          </span>
        )}
      </p>

      <div className="mt-5">
        <label
          htmlFor="reason"
          className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]"
        >
          Note for the vendor (optional)
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          rows={2}
          placeholder="Stairs at the front door. Use the side gate."
          className="mt-1 w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] p-3 text-[15px]"
        />
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[430px] items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] rounded-[var(--radius-btn)] border border-[var(--line)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]"
          >
            Back
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onNext}
            disabled={!urgency || !targetIso}
            className="min-h-[48px] rounded-[var(--radius-btn)] px-7 text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-40"
            style={{ background: "var(--salmon)", color: "#24333F" }}
          >
            Compare vendors
          </button>
        </div>
      </div>
    </div>
  );
}
