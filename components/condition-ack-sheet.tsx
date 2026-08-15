"use client";

import { useState } from "react";
import type { ConditionValue } from "@/src/lib/domain";
import { CONDITION_LABEL } from "@/src/lib/domain";

const OPTIONS: ConditionValue[] = ["none", "dirty", "damaged", "not_working"];

export type ConditionAckSheetProps = {
  itemLabel: string;
  defaultValue?: ConditionValue;
  onSelect?: (value: ConditionValue) => void; // STUB — writes condition_reported
  onDone?: () => void; // STUB
};

export default function ConditionAckSheet({
  itemLabel,
  defaultValue,
  onSelect,
  onDone,
}: ConditionAckSheetProps) {
  const [value, setValue] = useState<ConditionValue | undefined>(defaultValue);

  function pick(next: ConditionValue) {
    setValue(next);
    onSelect?.(next);
    if (next === "none") onDone?.();
  }

  return (
    <section
      aria-label="Report equipment condition"
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <p
        className="text-[16.5px] font-semibold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        How did it arrive?
      </p>
      <p className="mt-0.5 text-[13.5px] text-[var(--ink-soft)]">{itemLabel}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => pick(option)}
              className="min-h-[52px] rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em]"
              style={{
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "#FFFFFF" : "var(--ink)",
                border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
              }}
            >
              {CONDITION_LABEL[option]}
            </button>
          );
        })}
      </div>

      {value && value !== "none" ? (
        <div className="mt-3 rounded-[8px] border border-dashed border-[var(--line)] p-3">
          <p className="text-[13.5px] text-[var(--ink-soft)]">
            Add a photo if you can. Optional.
          </p>
          <button
            type="button"
            className="mt-2 min-h-[44px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em]"
          >
            Add photo
          </button>
        </div>
      ) : null}

      {value && value !== "none" ? (
        <button
          type="button"
          onClick={onDone}
          className="mt-3 min-h-[48px] w-full rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em]"
          style={{ background: "var(--salmon)", color: "var(--ink)" }}
        >
          Save condition
        </button>
      ) : null}
    </section>
  );
}
