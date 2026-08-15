"use client";

import { useState } from "react";
import type { ConditionValue } from "@/src/lib/domain";
import { CONDITION_LABEL } from "@/src/lib/domain";

const OPTIONS: ConditionValue[] = ["none", "dirty", "damaged", "not_working"];

export type ConditionAckSheetProps = {
  itemLabel: string;
  defaultValue?: ConditionValue;
  /** Fires on every tap. Selection only — it does not write. */
  onSelect?: (value: ConditionValue) => void;
  /**
   * The write. `condition_reported` is appended here, once, with the value the
   * person settled on. "None" commits on the single tap; anything else waits so
   * a photo can be attached first.
   */
  onDone?: (value: ConditionValue) => void;
  /** Photo capture supplied by the caller. Replaces the placeholder button. */
  photoSlot?: React.ReactNode;
  pending?: boolean;
  /** Verbatim server message. Never swallowed — a failed write must be visible. */
  error?: string | null;
  saveLabel?: string;
};

export default function ConditionAckSheet({
  itemLabel,
  defaultValue,
  onSelect,
  onDone,
  photoSlot,
  pending = false,
  error,
  saveLabel,
}: ConditionAckSheetProps) {
  const [value, setValue] = useState<ConditionValue | undefined>(defaultValue);

  function pick(next: ConditionValue) {
    setValue(next);
    onSelect?.(next);
    if (next === "none") onDone?.(next);
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
              disabled={pending}
              onClick={() => pick(option)}
              className="min-h-[52px] rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
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
          {photoSlot ?? (
            <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
              Photo capture is not available on this screen.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[8px] px-3 py-2 text-[13.5px]"
          style={{ background: "var(--red-tint)", color: "var(--ink)" }}
        >
          {error}
        </p>
      ) : null}

      {value && value !== "none" ? (
        <button
          type="button"
          onClick={() => onDone?.(value)}
          disabled={pending}
          className="mt-3 min-h-[48px] w-full rounded-[var(--radius-btn)] text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-60"
          style={{ background: "var(--salmon)", color: "var(--ink)" }}
        >
          {pending ? "Saving" : (saveLabel ?? "Save condition")}
        </button>
      ) : null}
    </section>
  );
}
