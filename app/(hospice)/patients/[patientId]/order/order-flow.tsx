"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import BigActionButton from "@/components/big-action-button";
import VendorCompareCard from "@/components/vendor-compare-card";
import { AssumedLabel } from "@/components/labels";
import { placeOrder } from "@/app/actions/place-order";
import { formatDayTime, formatUsd, URGENCY_LABEL, type OrderUrgency } from "@/src/lib/domain";
import {
  ADMISSION_BUNDLE,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CatalogRow,
  type OrderFlowData,
  buildOffers,
  clearDraft,
  EMPTY_DRAFT,
  isoToLocalInput,
  localInputToIso,
  readDraft,
  writeDraft,
  type OrderDraft,
} from "./draft";

type Step = "items" | "when" | "vendor";

const STEP_TITLE: Record<Step, string> = {
  items: "What do they need?",
  when: "When is it needed?",
  vendor: "Who should bring it?",
};

const URGENCY_HELP: Record<OrderUrgency, string> = {
  admission: "Coming home today or tomorrow.",
  routine: "Part of the ongoing plan of care.",
  stat: "Needed within hours.",
};

function wholeDollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents);
}

function isStep(value: string | null): value is Step {
  return value === "items" || value === "when" || value === "vendor";
}

export default function OrderFlow({
  patientId,
  data,
}: {
  patientId: string;
  data: OrderFlowData;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const stepParam = params.get("step");
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(CATEGORY_ORDER[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // sessionStorage is only readable after mount; server and first client render must match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(readDraft(patientId));
    setHydrated(true);
  }, [patientId]);

  useEffect(() => {
    if (hydrated) writeDraft(patientId, draft);
  }, [hydrated, patientId, draft]);

  const step: Step = isStep(stepParam) ? stepParam : "items";

  const byCategory = useMemo(() => {
    const map = new Map<string, CatalogRow[]>();
    for (const row of data.catalog) {
      const list = map.get(row.category);
      if (list) list.push(row);
      else map.set(row.category, [row]);
    }
    return map;
  }, [data.catalog]);

  const nameByHcpcs = useMemo(
    () => new Map(data.catalog.map((row) => [row.hcpcs, row.plain_name])),
    [data.catalog],
  );

  function defaultTarget(urgency: OrderUrgency): string {
    const hours = data.leadTimeHours[urgency];
    return new Date(Date.parse(data.nowIso) + hours * 60 * 60 * 1000).toISOString();
  }

  /** Untouched drafts still have a needed-by: the lead time for the chosen urgency. */
  const targetAt = draft.targetAt ?? defaultTarget(draft.urgency);

  const offers = useMemo(
    () => buildOffers(draft.items, data.vendors, data.prices, data.nowIso, targetAt),
    [draft.items, targetAt, data.vendors, data.prices, data.nowIso],
  );

  // Best vendor is selected for the nurse; tapping another card overrides it.
  const selected = offers.find((offer) => offer.vendorId === draft.vendorId) ?? offers[0] ?? null;

  function goTo(next: Step) {
    router.push(`/patients/${patientId}/order?step=${next}`);
  }

  function toggleItem(hcpcs: string) {
    setDraft((current) => {
      const exists = current.items.some((item) => item.hcpcs === hcpcs);
      return {
        ...current,
        items: exists
          ? current.items.filter((item) => item.hcpcs !== hcpcs)
          : [...current.items, { hcpcs, qty: 1 }],
      };
    });
  }

  function setQty(hcpcs: string, qty: number) {
    if (qty < 1 || qty > 9) return;
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.hcpcs === hcpcs ? { ...item, qty } : item)),
    }));
  }

  function addBundle() {
    setDraft((current) => {
      const items = [...current.items];
      for (const hcpcs of ADMISSION_BUNDLE) {
        if (!items.some((item) => item.hcpcs === hcpcs)) items.push({ hcpcs, qty: 1 });
      }
      return { ...current, items };
    });
  }

  function chooseUrgency(urgency: OrderUrgency) {
    setDraft((current) => {
      const hours = data.leadTimeHours[urgency];
      const target = new Date(Date.parse(data.nowIso) + hours * 60 * 60 * 1000).toISOString();
      return { ...current, urgency, targetAt: target };
    });
  }

  function submit() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await placeOrder({
        patientId,
        vendorId: selected.vendorId,
        urgency: draft.urgency,
        targetAt,
        items: draft.items,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      clearDraft(patientId);
      router.push(result.redirectTo);
    });
  }

  const count = draft.items.length;
  const needsApproval = selected ? selected.totalCents >= data.thresholdCents : false;

  return (
    <section className="pb-24">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--burnt)]">
          Step {step === "items" ? "1" : step === "when" ? "2" : "3"} of 3
        </p>
        <h1
          className="mt-1 text-[24px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          {STEP_TITLE[step]}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{data.patientName}</p>
      </header>

      {step === "items" ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={addBundle}
            className="w-full rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-left"
            style={{ boxShadow: "var(--shadow)", minHeight: 44 }}
          >
            <span className="block text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Typical admission bundle
            </span>
            <span className="mt-1 block text-[13.5px] text-[var(--ink-soft)]">
              Bed, mattress, oxygen concentrator, commode, walker. One tap adds all five.
            </span>
          </button>

          <div className="mt-4 flex flex-col gap-3">
            {CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
              const rows = byCategory.get(category) ?? [];
              const open = openCategory === category;
              const chosen = rows.filter((row) =>
                draft.items.some((item) => item.hcpcs === row.hcpcs),
              ).length;
              return (
                <div
                  key={category}
                  className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]"
                  style={{ boxShadow: "var(--shadow)" }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenCategory(open ? null : category)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    style={{ minHeight: 44 }}
                  >
                    <span className="text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {CATEGORY_LABEL[category] ?? category}
                    </span>
                    <span className="text-[13px] text-[var(--ink-soft)]">
                      {chosen > 0 ? `${chosen} chosen` : open ? "Hide" : "Show"}
                    </span>
                  </button>

                  {open ? (
                    <ul className="border-t border-[var(--line)]">
                      {rows.map((row) => {
                        const picked = draft.items.find((item) => item.hcpcs === row.hcpcs);
                        return (
                          <li key={row.hcpcs} className="border-b border-[var(--line-soft)] last:border-b-0">
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <button
                                type="button"
                                onClick={() => toggleItem(row.hcpcs)}
                                aria-pressed={Boolean(picked)}
                                className="flex-1 text-left"
                                style={{ minHeight: 44 }}
                              >
                                <span className="block text-[16px] leading-snug">{row.plain_name}</span>
                                <span className="mt-0.5 block text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                                  {row.hcpcs}
                                </span>
                              </button>
                              {picked ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label={`Fewer ${row.plain_name}`}
                                    onClick={() => setQty(row.hcpcs, picked.qty - 1)}
                                    className="h-11 w-11 rounded-[var(--radius-btn)] border border-[var(--line)] text-[18px]"
                                  >
                                    -
                                  </button>
                                  <span className="w-5 text-center text-[16px] font-semibold">{picked.qty}</span>
                                  <button
                                    type="button"
                                    aria-label={`More ${row.plain_name}`}
                                    onClick={() => setQty(row.hcpcs, picked.qty + 1)}
                                    className="h-11 w-11 rounded-[var(--radius-btn)] border border-[var(--line)] text-[18px]"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleItem(row.hcpcs)}
                                  className="h-11 rounded-[var(--radius-btn)] px-4 text-[12px] font-extrabold uppercase tracking-[0.04em]"
                                  style={{ background: "var(--paper-alt)", color: "var(--ink)" }}
                                >
                                  Add
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="fixed inset-x-0 bottom-[72px] z-10 border-t border-[var(--line)] bg-[var(--paper)] px-5 py-3">
            <div className="mx-auto flex max-w-[430px] items-center gap-3">
              <span className="text-[14px] text-[var(--ink-soft)]">
                {count} {count === 1 ? "item" : "items"}
              </span>
              <div className="flex-1">
                <BigActionButton tone="primary" size="lg" disabled={count === 0} onClick={() => goTo("when")}>
                  NEXT
                </BigActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === "when" ? (
        <div className="mt-5">
          <div className="flex flex-col gap-3">
            {(["admission", "routine", "stat"] as OrderUrgency[]).map((urgency) => {
              const active = draft.urgency === urgency;
              return (
                <button
                  key={urgency}
                  type="button"
                  onClick={() => chooseUrgency(urgency)}
                  aria-pressed={active}
                  className="rounded-[var(--radius-card)] bg-[var(--surface)] p-4 text-left"
                  style={{
                    boxShadow: "var(--shadow)",
                    border: active ? "2px solid var(--salmon)" : "1px solid var(--line)",
                    minHeight: 64,
                  }}
                >
                  <span className="block text-[18px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    {URGENCY_LABEL[urgency]}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] text-[var(--ink-soft)]">
                    {URGENCY_HELP[urgency]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4" style={{ boxShadow: "var(--shadow)" }}>
            <label htmlFor="target-at" className="block text-[14px] font-semibold">
              Needed by
            </label>
            <input
              id="target-at"
              type="datetime-local"
              value={isoToLocalInput(targetAt)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  targetAt: localInputToIso(event.target.value) ?? current.targetAt,
                }))
              }
              className="mt-2 w-full rounded-[var(--radius-btn)] border border-[var(--line)] bg-[var(--paper)] px-3 text-[16px]"
              style={{ minHeight: 48 }}
            />
            <p className="mt-3 text-[15px]">Must arrive before {formatDayTime(targetAt)}.</p>
            <div className="mt-1">
              <AssumedLabel>Default needed-by uses the lead time in Settings</AssumedLabel>
            </div>
          </div>

          <div className="mt-6">
            <BigActionButton tone="primary" size="lg" onClick={() => goTo("vendor")}>
              SEE VENDORS
            </BigActionButton>
          </div>
        </div>
      ) : null}

      {step === "vendor" ? (
        <div className="mt-5">
          <ul className="text-[14px] text-[var(--ink-soft)]">
            {draft.items.map((item) => (
              <li key={item.hcpcs}>
                {item.qty > 1 ? `${item.qty} x ` : ""}
                {nameByHcpcs.get(item.hcpcs) ?? item.hcpcs}
              </li>
            ))}
          </ul>

          {offers.length === 0 ? (
            <p className="mt-5 text-[15px]">
              No contracted vendor carries this item. Ask your DON.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3">
                {offers.map((offer) => (
                  <VendorCompareCard
                    key={offer.vendorId}
                    vendorName={offer.vendorName}
                    price={offer.totalCents}
                    eta={offer.etaIso}
                    deadline={targetAt}
                    meetsDeadline={offer.meetsDeadline}
                    reliability={offer.reliability}
                    condition={offer.condition}
                    hoursBadge={offer.openWeekends ? "Open weekends" : undefined}
                    stockLabel={offer.allInStock ? "In stock" : "Some items out of stock"}
                    selected={selected?.vendorId === offer.vendorId}
                    onSelect={() =>
                      setDraft((current) => ({
                        ...current,
                        vendorId: offer.vendorId,
                      }))
                    }
                  />
                ))}
              </div>

              {needsApproval ? (
                <div
                  className="mt-4 rounded-[var(--radius-card)] border p-4"
                  style={{ background: "var(--taupe)", borderColor: "var(--line)" }}
                >
                  <p className="text-[15px]">
                    This order goes to your Director of Nursing before the vendor hears about it.
                  </p>
                  <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
                    Approval limit {wholeDollars(data.thresholdCents)}. Default value, editable in Settings.
                    {draft.urgency === "stat" ? " STAT orders still need approval." : ""}
                  </p>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-[var(--radius-card)] border p-4"
                  style={{ background: "var(--red-tint)", borderColor: "var(--red)" }}
                >
                  <p className="text-[15px]">{error}</p>
                </div>
              ) : null}

              <div className="mt-5">
                <BigActionButton
                  tone="primary"
                  size="xl"
                  disabled={pending || !selected}
                  onClick={submit}
                >
                  {pending ? "PLACING ORDER" : "PLACE ORDER"}
                </BigActionButton>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
