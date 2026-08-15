"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderUrgency } from "@/src/lib/domain";
import ItemsStep from "./items-step";
import WhenStep from "./when-step";
import VendorStep from "./vendor-step";
import {
  EMPTY_DRAFT,
  readDraft,
  toIso,
  toLocalInputValue,
  writeDraft,
  type DraftItem,
  type OrderDraft,
} from "./draft";
import {
  ADMISSION_BUNDLE_CODES,
  type CatalogItem,
  type FlowStep,
  type OrderContextData,
} from "./types";

const STEP_INDEX: Record<FlowStep, number> = { items: 0, when: 1, vendor: 2 };
const STEP_LABEL: Record<FlowStep, string> = {
  items: "Step 1 of 3 · What",
  when: "Step 2 of 3 · When",
  vendor: "Step 3 of 3 · Who",
};

export default function OrderFlow({
  step,
  patientId,
  patientName,
  context,
  nowIso,
}: {
  step: FlowStep;
  patientId: string;
  patientName: string;
  context: OrderContextData;
  nowIso: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(readDraft(patientId));
    setHydrated(true);
  }, [patientId]);

  function update(next: Partial<OrderDraft>) {
    setDraft((current) => {
      const merged = { ...current, ...next };
      writeDraft(patientId, merged);
      return merged;
    });
  }

  function go(next: FlowStep) {
    router.push(`/order/${patientId}?step=${next}`);
  }

  const targetIso = toIso(draft.targetAt);

  // The draft is the source of truth for which step is reachable: a deep link into
  // step 3 with nothing chosen lands on step 1 instead of rendering an empty compare.
  useEffect(() => {
    if (!hydrated) return;
    if (step !== "items" && draft.items.length === 0) {
      router.replace(`/order/${patientId}?step=items`);
      return;
    }
    if (step === "vendor" && (!draft.urgency || !toIso(draft.targetAt))) {
      router.replace(`/order/${patientId}?step=when`);
    }
  }, [hydrated, step, draft.items.length, draft.urgency, draft.targetAt, patientId, router]);

  function toggleItem(item: CatalogItem) {
    const exists = draft.items.some((i) => i.hcpcs === item.hcpcs);
    const items: DraftItem[] = exists
      ? draft.items.filter((i) => i.hcpcs !== item.hcpcs)
      : [
          ...draft.items,
          { hcpcs: item.hcpcs, plainName: item.plainName, category: item.category, qty: 1 },
        ];
    update({ items, vendorId: null });
  }

  function setQty(hcpcs: string, qty: number) {
    update({ items: draft.items.map((i) => (i.hcpcs === hcpcs ? { ...i, qty } : i)) });
  }

  /** Bundle preset — one order per item (contracts amendment 3), no bundle id. */
  function applyBundle() {
    const all = ADMISSION_BUNDLE_CODES.every((code) =>
      draft.items.some((i) => i.hcpcs === code),
    );
    if (all) {
      update({
        items: draft.items.filter((i) => !ADMISSION_BUNDLE_CODES.includes(i.hcpcs)),
        fromBundle: false,
        vendorId: null,
      });
      return;
    }
    const additions: DraftItem[] = ADMISSION_BUNDLE_CODES.flatMap((code) => {
      if (draft.items.some((i) => i.hcpcs === code)) return [];
      const found = context.catalog.find((c) => c.hcpcs === code);
      if (!found) return [];
      return [{ hcpcs: found.hcpcs, plainName: found.plainName, category: found.category, qty: 1 }];
    });
    update({ items: [...draft.items, ...additions], fromBundle: true, vendorId: null });
  }

  /**
   * The fastest any single vendor could get EVERY chosen item there, in hours.
   * A bundle is only as fast as its slowest item, so this is a max within a vendor
   * and a min across vendors. Returns null when nobody carries the whole list.
   */
  function fastestFeasibleHours(): number | null {
    if (draft.items.length === 0) return null;
    const options = context.vendors
      .filter((v) => draft.items.every((i) => v.prices[i.hcpcs]))
      .map((v) => Math.max(...draft.items.map((i) => v.prices[i.hcpcs].leadTimeHours)));
    if (options.length === 0) return null;
    const fastest = Math.min(...options);
    return Number.isFinite(fastest) ? fastest : null;
  }

  function setUrgency(urgency: OrderUrgency) {
    // Pre-fill "needed by" so the common case is one tap. For a planned admission or
    // routine order the suggestion respects what vendors can actually do, plus two
    // hours of room. STAT keeps its own short window: the deadline on a STAT order
    // comes from the patient, not from what suppliers find convenient, and if nobody
    // can make it the compare screen says so rather than quietly moving the goalpost.
    const fastest = fastestFeasibleHours();
    const hours =
      urgency === "stat"
        ? context.leadTimeHours.stat
        : Math.max(context.leadTimeHours[urgency], fastest === null ? 0 : fastest + 2);
    const suggested = draft.targetAt
      ? draft.targetAt
      : toLocalInputValue(new Date(new Date(nowIso).getTime() + hours * 3_600_000));
    update({ urgency, targetAt: suggested, vendorId: null });
  }

  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {STEP_LABEL[step]} · {patientName}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {(["items", "when", "vendor"] as FlowStep[]).map((s) => (
          <span
            key={s}
            className="h-[4px] flex-1 rounded"
            style={{
              background:
                STEP_INDEX[s] <= STEP_INDEX[step] ? "var(--salmon)" : "var(--line)",
            }}
          />
        ))}
      </div>

      <div className="mt-4">
        {step === "items" ? (
          <ItemsStep
            catalog={context.catalog}
            items={draft.items}
            onToggle={toggleItem}
            onQty={setQty}
            onBundle={applyBundle}
            onNext={() => go("when")}
          />
        ) : null}

        {step === "when" ? (
          <WhenStep
            urgency={draft.urgency}
            targetAt={draft.targetAt}
            reason={draft.reason}
            leadTimeHours={context.leadTimeHours}
            fastestHours={fastestFeasibleHours()}
            nowIso={nowIso}
            onUrgency={setUrgency}
            onTargetAt={(value) => update({ targetAt: value, vendorId: null })}
            onReason={(value) => update({ reason: value })}
            onBack={() => go("items")}
            onNext={() => go("vendor")}
          />
        ) : null}

        {step === "vendor" && draft.urgency && targetIso ? (
          <VendorStep
            patientId={patientId}
            patientName={patientName}
            vendors={context.vendors}
            items={draft.items}
            urgency={draft.urgency}
            targetIso={targetIso}
            nowIso={nowIso}
            reason={draft.reason}
            donThresholdCents={context.donThresholdCents}
            donThresholdFromSettings={context.donThresholdFromSettings}
            selectedVendorId={draft.vendorId}
            onSelectVendor={(vendorId) => update({ vendorId })}
            onBack={() => go("when")}
          />
        ) : null}
      </div>
    </section>
  );
}
