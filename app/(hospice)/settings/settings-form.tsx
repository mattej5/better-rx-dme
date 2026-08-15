"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsActionState } from "@/app/actions/settings";
import { AssumedLabel } from "@/components/labels";
import type { SettingKey, SettingsValues } from "./data";

const initialState: SettingsActionState = { ok: false, message: "" };

type NumberFieldProps = {
  defaultValue: number;
  disabled: boolean;
  label: string;
  max?: number;
  min?: number;
  name: string;
  persisted: boolean;
  prefix?: string;
  step?: number;
  suffix: string;
};

function NumberField({
  defaultValue,
  disabled,
  label,
  max,
  min = 0,
  name,
  persisted,
  prefix,
  step = 1,
  suffix,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-[13px] font-semibold">
        <span>{label}</span>
        <AssumedLabel />
      </span>
      <span className="mt-1.5 flex min-h-12 items-center overflow-hidden rounded-[var(--radius-btn)] border border-[var(--line)] bg-surface focus-within:border-[var(--royal)] focus-within:ring-2 focus-within:ring-[var(--royal-tint)]">
        {prefix ? (
          <span className="pl-3.5 text-[15px] font-semibold text-ink-soft">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          name={name}
          defaultValue={defaultValue}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          required
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[16px] font-semibold outline-none disabled:cursor-not-allowed disabled:text-ink-soft"
        />
        <span className="pr-3.5 text-[12px] font-semibold text-ink-soft">
          {suffix}
        </span>
      </span>
      {!persisted ? (
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--burnt-dark)]">
          Not yet persisted
        </span>
      ) : null}
    </label>
  );
}

function SettingCard({
  children,
  description,
  persisted,
  title,
}: {
  children: React.ReactNode;
  description: string;
  persisted: boolean;
  title: string;
}) {
  return (
    <fieldset className="rounded-[var(--radius-card)] border border-[var(--line)] bg-surface p-4 shadow-[var(--shadow)]">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 border-b border-[var(--line-soft)] pb-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="!mb-0 text-[15px] font-bold">{title}</h2>
          {!persisted ? (
            <span className="shrink-0 rounded-full bg-[var(--taupe)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[var(--burnt-dark)]">
              Not yet persisted
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] leading-5 text-ink-soft">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </fieldset>
  );
}

export default function SettingsForm({
  editable,
  persisted,
  values,
}: {
  editable: boolean;
  persisted: SettingKey[];
  values: SettingsValues;
}) {
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const isPersisted = (key: SettingKey) => persisted.includes(key);
  const disabled = !editable || pending;

  return (
    <form action={action} className="mt-5 grid gap-3">
      <SettingCard
        title="Approval"
        description="Orders at or above this total require DON approval."
        persisted={isPersisted("don_threshold_cents")}
      >
        <NumberField
          label="DON approval threshold"
          name="don_threshold_dollars"
          defaultValue={values.don_threshold_cents / 100}
          disabled={disabled}
          prefix="$"
          suffix="dollars"
          step={0.01}
          persisted={isPersisted("don_threshold_cents")}
        />
      </SettingCard>

      <SettingCard
        title="Delivery lead time"
        description="Expected time from order placement to delivery."
        persisted={isPersisted("lead_time_hours")}
      >
        <NumberField label="STAT" name="lead_time_stat" defaultValue={values.lead_time_hours.stat} disabled={disabled} suffix="hours" persisted={isPersisted("lead_time_hours")} />
        <NumberField label="Admission" name="lead_time_admission" defaultValue={values.lead_time_hours.admission} disabled={disabled} suffix="hours" persisted={isPersisted("lead_time_hours")} />
        <NumberField label="Routine" name="lead_time_routine" defaultValue={values.lead_time_hours.routine} disabled={disabled} suffix="hours" persisted={isPersisted("lead_time_hours")} />
      </SettingCard>

      <SettingCard
        title="Vendor response window"
        description="Maximum wait for a vendor confirmation."
        persisted={isPersisted("silence_minutes")}
      >
        <NumberField label="STAT" name="silence_stat" defaultValue={values.silence_minutes.stat} disabled={disabled} suffix="minutes" persisted={isPersisted("silence_minutes")} />
        <NumberField label="Admission" name="silence_admission" defaultValue={values.silence_minutes.admission} disabled={disabled} suffix="minutes" persisted={isPersisted("silence_minutes")} />
        <NumberField label="Routine" name="silence_routine" defaultValue={values.silence_minutes.routine} disabled={disabled} suffix="minutes" persisted={isPersisted("silence_minutes")} />
      </SettingCard>

      <SettingCard
        title="Pickup delay"
        description="Time after a pickup request before the order is flagged."
        persisted={isPersisted("pickup_amber_h") && isPersisted("pickup_red_h")}
      >
        <NumberField label="Amber warning" name="pickup_amber_h" defaultValue={values.pickup_amber_h} disabled={disabled} suffix="hours" persisted={isPersisted("pickup_amber_h")} />
        <NumberField label="Red warning" name="pickup_red_h" defaultValue={values.pickup_red_h} disabled={disabled} suffix="hours" persisted={isPersisted("pickup_red_h")} />
      </SettingCard>

      <SettingCard
        title="Notification baseline"
        description="Baseline lag used to calculate equipment-days avoided."
        persisted={isPersisted("baseline_notify_lag_h")}
      >
        <NumberField label="Baseline notification lag" name="baseline_notify_lag_h" defaultValue={values.baseline_notify_lag_h} disabled={disabled} suffix="hours" persisted={isPersisted("baseline_notify_lag_h")} />
      </SettingCard>

      <SettingCard
        title="High-risk buffer"
        description="Extra time added before an order is treated as high risk."
        persisted={isPersisted("high_risk_buffer_h")}
      >
        <NumberField label="High-risk buffer (hours)" name="high_risk_buffer_h" defaultValue={values.high_risk_buffer_h} disabled={disabled} suffix="hours" persisted={isPersisted("high_risk_buffer_h")} />
      </SettingCard>

      <SettingCard
        title="ETA amber margin"
        description="Margin before an ETA miss is flagged amber."
        persisted={isPersisted("eta_amber_margin_min")}
      >
        <NumberField label="ETA amber margin (minutes)" name="eta_amber_margin_min" defaultValue={values.eta_amber_margin_min} disabled={disabled} suffix="minutes" persisted={isPersisted("eta_amber_margin_min")} />
      </SettingCard>

      {editable ? (
        <button
          type="submit"
          disabled={pending}
          className="mt-2 min-h-12 rounded-[var(--radius-btn)] bg-[var(--salmon)] px-5 text-[14px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink)] transition-colors hover:bg-[var(--salmon-hover)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--royal)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      ) : null}

      {state.message ? (
        <p
          aria-live="polite"
          className={`rounded-[var(--radius-card)] border px-4 py-3 text-[13px] font-semibold ${
            state.ok
              ? "border-[var(--green)] bg-[var(--green-tint)]"
              : "border-[var(--red)] bg-[var(--red-tint)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
