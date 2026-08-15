"use client";

import { useState } from "react";
import ItemPhoto from "./item-photo";
import {
  ADMISSION_BUNDLE_CODES,
  CATEGORY_HINT,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CatalogItem,
  type CategoryKey,
} from "./types";
import type { DraftItem } from "./draft";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path d="M6 9l6 6 6-6" stroke="var(--ink-soft)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: on ? "var(--salmon)" : "var(--surface)",
        border: on ? "0" : "2px solid var(--line)",
      }}
    >
      {on ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#24333F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

export default function ItemsStep({
  catalog,
  items,
  onToggle,
  onQty,
  onBundle,
  onNext,
}: {
  catalog: CatalogItem[];
  items: DraftItem[];
  onToggle: (item: CatalogItem) => void;
  onQty: (hcpcs: string, qty: number) => void;
  onBundle: () => void;
  onNext: () => void;
}) {
  const present = new Set(CATEGORY_ORDER.filter((c) => catalog.some((i) => i.category === c)));
  const [open, setOpen] = useState<CategoryKey | null>(
    CATEGORY_ORDER.find((c) => present.has(c)) ?? null,
  );
  const chosen = new Map(items.map((i) => [i.hcpcs, i.qty]));
  const bundleOn = ADMISSION_BUNDLE_CODES.every((c) => chosen.has(c));

  return (
    <div className="pb-[92px]">
      <h1 className="text-[24px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
        What does this patient need?
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        Tap everything you want delivered. You pick who brings it on the next screen.
      </p>

      <button
        type="button"
        onClick={onBundle}
        className="mt-4 w-full rounded-[var(--radius-card)] border p-4 text-left"
        style={{
          background: bundleOn ? "var(--taupe)" : "var(--surface)",
          borderColor: bundleOn ? "var(--burnt)" : "var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Typical admission bundle
            </span>
            <span className="mt-0.5 block text-[13px] text-[var(--ink-soft)]">
              Bed, mattress, oxygen concentrator, commode, walker
            </span>
          </span>
          <Check on={bundleOn} />
        </span>
        <span className="mt-2 block text-[12px] text-[var(--ink-soft)]">
          Places 5 separate orders, one per item, so each one gets its own status.
        </span>
      </button>

      <div className="mt-4 flex flex-col gap-2">
        {CATEGORY_ORDER.filter((c) => present.has(c)).map((category) => {
          const rows = catalog.filter((i) => i.category === category);
          const count = rows.filter((r) => chosen.has(r.hcpcs)).length;
          const isOpen = open === category;
          return (
            <section
              key={category}
              className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : category)}
                aria-expanded={isOpen}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    {CATEGORY_LABEL[category]}
                  </span>
                  <span className="block text-[12.5px] text-[var(--ink-soft)]">
                    {count > 0 ? `${count} chosen · ${CATEGORY_HINT[category]}` : CATEGORY_HINT[category]}
                  </span>
                </span>
                <Chevron open={isOpen} />
              </button>

              {isOpen ? (
                <ul className="m-0 list-none border-t border-[var(--line)] p-0">
                  {rows.map((row) => {
                    const qty = chosen.get(row.hcpcs);
                    const on = qty !== undefined;
                    return (
                      <li key={row.hcpcs} className="border-b border-[var(--line)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => onToggle(row)}
                          aria-pressed={on}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                          style={{ background: on ? "var(--paper-alt)" : undefined }}
                        >
                          <ItemPhoto category={row.category} imageUrl={row.imageUrl} plainName={row.plainName} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15.5px] font-semibold leading-tight">
                              {row.plainName}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                              {row.hcpcs}
                              {row.hazmat ? " · Hazmat" : ""}
                            </span>
                          </span>
                          <Check on={on} />
                        </button>

                        {on ? (
                          <div className="flex items-center gap-3 px-4 pb-3">
                            <span className="text-[12.5px] text-[var(--ink-soft)]">How many</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={`One fewer ${row.plainName}`}
                                onClick={() => onQty(row.hcpcs, Math.max(1, (qty ?? 1) - 1))}
                                className="h-[36px] w-[36px] rounded-[var(--radius-btn)] border border-[var(--line)] text-[18px] font-bold"
                              >
                                −
                              </button>
                              <span className="min-w-[22px] text-center text-[15px] font-semibold">{qty}</span>
                              <button
                                type="button"
                                aria-label={`One more ${row.plainName}`}
                                onClick={() => onQty(row.hcpcs, (qty ?? 1) + 1)}
                                className="h-[36px] w-[36px] rounded-[var(--radius-btn)] border border-[var(--line)] text-[18px] font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-20 border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[430px] items-center gap-3 px-5 py-3">
          <span className="flex-1 text-[14px] font-semibold">
            {items.length === 0
              ? "Nothing chosen yet"
              : `${items.length} ${items.length === 1 ? "item" : "items"}`}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={items.length === 0}
            className="min-h-[48px] rounded-[var(--radius-btn)] px-7 text-[14px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-40"
            style={{ background: "var(--salmon)", color: "#24333F" }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
