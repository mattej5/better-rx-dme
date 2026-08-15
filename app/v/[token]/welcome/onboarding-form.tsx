"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import BigActionButton from "@/components/big-action-button";
import { submitOnboarding } from "./actions";

export type CatalogItem = { hcpcs: string; plainName: string; category: string };
export type CategoryOption = { key: string; label: string };

export type OnboardingFormProps = {
  token: string;
  items: CatalogItem[];
  categories: CategoryOption[];
  initialInventory: Record<string, number>;
  initialCategories: string[];
  initialPricingModel: string;
  initialZip: string;
  initialRadius: number | null;
};

const PRICING_OPTIONS = [
  {
    value: "per_item_day",
    title: "Per item, per day",
    detail: "Each piece of equipment is billed for the days it sits in the home.",
  },
  {
    value: "per_patient_day",
    title: "One daily rate per patient",
    detail: "One flat daily price covers everything in that home.",
  },
] as const;

function labelClass(on: boolean): string {
  return [
    "min-h-[44px] rounded-[var(--radius-btn)] px-3 text-[13px] font-extrabold uppercase tracking-[0.04em]",
    on ? "" : "border border-[var(--line)]",
  ].join(" ");
}

export default function OnboardingForm(props: OnboardingFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<string[]>(props.initialCategories);
  const [inventory, setInventory] = useState<Record<string, number>>(
    props.initialInventory,
  );
  const [pricingModel, setPricingModel] = useState<string>(props.initialPricingModel);
  const [zip, setZip] = useState(props.initialZip);
  const [radius, setRadius] = useState(
    props.initialRadius === null ? "" : String(props.initialRadius),
  );
  const [error, setError] = useState<string | null>(null);
  const [donePath, setDonePath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visibleItems = useMemo(
    () => props.items.filter((item) => picked.includes(item.category)),
    [props.items, picked],
  );

  const chosen = useMemo(
    () =>
      props.items.filter(
        (item) => picked.includes(item.category) && (inventory[item.hcpcs] ?? 0) > 0,
      ),
    [props.items, picked, inventory],
  );

  function toggleCategory(key: string) {
    setPicked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function setQty(hcpcs: string, raw: string) {
    const value = Number(raw);
    setInventory((prev) => ({
      ...prev,
      [hcpcs]: Number.isFinite(value) && value > 0 ? Math.floor(value) : 0,
    }));
  }

  function save() {
    setError(null);
    const payload = {
      inventory: Object.fromEntries(
        chosen.map((item) => [item.hcpcs, inventory[item.hcpcs] ?? 0]),
      ),
      pricingModel,
      serviceCenterZip: zip.trim(),
      serviceRadiusMiles: Number(radius),
    };
    startTransition(async () => {
      const result = await submitOnboarding(props.token, payload);
      if (result.ok) setDonePath(result.runListPath);
      else setError(result.message);
    });
  }

  if (donePath) {
    return (
      <section>
        <h2
          className="mt-2 text-[22px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          You&rsquo;re set up
        </h2>
        <p className="mt-2 text-[15px]">
          {chosen.length} item{chosen.length === 1 ? "" : "s"} on file, {radius} miles
          from {zip}.
        </p>
        <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
          When a hospice orders something you carry, you get a text with a link. There is
          no password and no app to install.
        </p>
        <div className="mt-5">
          <Link
            href={donePath}
            className="flex min-h-[56px] items-center justify-center rounded-[var(--radius-btn)] text-[16px] font-extrabold uppercase tracking-[0.04em]"
            style={{ background: "var(--salmon)", color: "#24333F" }}
          >
            See your stops
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        Step {step} of 2
      </p>

      {step === 1 ? (
        <>
          <h2
            className="mt-1 text-[20px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            What do you carry?
          </h2>
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
            Tap the kinds of equipment you stock, then put in how many you have on hand.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {props.categories.map((category) => {
              const on = picked.includes(category.key);
              return (
                <button
                  key={category.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(category.key)}
                  className={labelClass(on)}
                  style={
                    on
                      ? { background: "var(--salmon)", color: "#24333F" }
                      : { background: "var(--surface)", color: "var(--ink)" }
                  }
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <p className="mt-5 text-[14px] text-[var(--ink-soft)]">
              Pick at least one kind of equipment above.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none p-0">
              {visibleItems.map((item) => (
                <li
                  key={item.hcpcs}
                  className="flex items-center justify-between gap-3 border-t border-[var(--line-soft)] py-2"
                >
                  <label htmlFor={`qty-${item.hcpcs}`} className="text-[15px]">
                    {item.plainName}{" "}
                    <span className="text-[12px] text-[var(--ink-soft)]">
                      {item.hcpcs}
                    </span>
                  </label>
                  <input
                    id={`qty-${item.hcpcs}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={inventory[item.hcpcs] ?? 0}
                    onChange={(e) => setQty(item.hcpcs, e.target.value)}
                    className="h-[44px] w-[76px] shrink-0 rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-2 text-center text-[16px]"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <BigActionButton
              size="lg"
              tone="primary"
              disabled={chosen.length === 0}
              onClick={() => setStep(2)}
            >
              Next: your area
            </BigActionButton>
          </div>
        </>
      ) : (
        <>
          <h2
            className="mt-1 text-[20px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Where do you drive, and how do you bill?
          </h2>

          <label
            htmlFor="zip"
            className="mt-4 block text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]"
          >
            ZIP your trucks leave from
          </label>
          <input
            id="zip"
            value={zip}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            className="mt-1 h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
          />

          <label
            htmlFor="radius"
            className="mt-4 block text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]"
          >
            How far you will drive (miles)
          </label>
          <input
            id="radius"
            type="number"
            min={1}
            inputMode="numeric"
            value={radius}
            onChange={(e) => setRadius(e.target.value.replace(/\D/g, ""))}
            className="mt-1 h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[16px]"
          />
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            You set this number. We only show you orders inside it.
          </p>

          <p className="mt-5 text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
            How you bill
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {PRICING_OPTIONS.map((option) => {
              const on = pricingModel === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPricingModel(option.value)}
                  className="rounded-[var(--radius-card)] border p-3 text-left"
                  style={{
                    borderColor: on ? "var(--salmon)" : "var(--line)",
                    background: on ? "var(--taupe)" : "var(--surface)",
                  }}
                >
                  <span className="block text-[15px] font-semibold">{option.title}</span>
                  <span className="block text-[13px] text-[var(--ink-soft)]">
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] p-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
              What you&rsquo;re confirming
            </p>
            <p className="mt-1 text-[14px]">
              {chosen.length} item{chosen.length === 1 ? "" : "s"} in stock ·{" "}
              {radius || "—"} miles from {zip || "—"} ·{" "}
              {pricingModel === "per_patient_day"
                ? "one daily rate per patient"
                : "per item, per day"}
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-[var(--radius-card)] border p-3"
              style={{ background: "var(--red-tint)", borderColor: "var(--red)" }}
            >
              <p className="text-[14px] text-[var(--ink)]">{error}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <BigActionButton
              size="xl"
              tone="primary"
              disabled={pending || zip.length !== 5 || Number(radius) <= 0}
              onClick={save}
            >
              {pending ? "Saving…" : "Finish setup"}
            </BigActionButton>
            <BigActionButton size="lg" tone="quiet" onClick={() => setStep(1)}>
              Back
            </BigActionButton>
          </div>
        </>
      )}
    </section>
  );
}
