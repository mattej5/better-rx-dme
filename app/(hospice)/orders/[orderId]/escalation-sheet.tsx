"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDayTime, formatUsd } from "@/src/lib/domain";
import { escalateOrder, nudgeVendor, reorderToBackup } from "../actions";
import type { BackupOption } from "./data";

function Row({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-t border-[var(--line)] py-4 first:border-t-0 first:pt-0">
      <p className="text-[15.5px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        {n}. {title}
      </p>
      <p className="mt-0.5 text-[13.5px] text-[var(--ink-soft)]">{body}</p>
      <div className="mt-2">{children}</div>
    </li>
  );
}

const btn =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-btn)] px-4 text-[12.5px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50";

/**
 * specs/frontend.md 2.4. Three ranked actions, every one human-confirmed, nothing
 * auto-cancels — and that is stated on screen rather than assumed.
 */
export default function EscalationSheet({
  orderId,
  reason,
  timeLeft,
  vendorName,
  vendorPhone,
  backups,
  isPickup,
  cleared,
}: {
  orderId: string;
  reason: string;
  timeLeft: string | null;
  vendorName: string | null;
  vendorPhone: string | null;
  backups: BackupOption[];
  isPickup: boolean;
  cleared: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmBackup, setConfirmBackup] = useState<string | null>(null);
  const backup = backups[0];

  function close() {
    router.push(`/orders/${orderId}`);
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0"
        style={{ background: "rgba(36,51,63,0.45)" }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="What do you want to do"
        className="relative max-h-[86vh] w-full max-w-[430px] overflow-y-auto rounded-t-[16px] bg-[var(--surface)] px-5 pb-8 pt-4"
      >
        <div className="mx-auto mb-3 h-[4px] w-[40px] rounded bg-[var(--line)]" aria-hidden="true" />

        {cleared ? (
          <div
            className="rounded-[var(--radius-card)] border p-4"
            style={{ background: "var(--green-tint)", borderColor: "var(--green)" }}
          >
            <h2 className="text-[18px]" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              Nothing is flagged right now
            </h2>
            <p className="mt-1 text-[14px]">{reason}</p>
          </div>
        ) : (
          <>
            <h2 className="text-[20px] leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              What do you want to do?
            </h2>
            <p className="mt-1 text-[14px]">{reason}</p>
            {timeLeft ? (
              <p className="mt-1 text-[13.5px] font-semibold text-[var(--burnt-dark)]">{timeLeft}</p>
            ) : null}
          </>
        )}

        <ul className="mt-4 flex list-none flex-col p-0">
          <Row
            n={1}
            title="Wait"
            body={`We keep texting ${vendorName ?? "the vendor"} on a schedule. You can send one now.`}
          >
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => nudgeVendor(orderId))}
              className={btn}
              style={{ background: "var(--salmon)", color: "#24333F" }}
            >
              Nudge again
            </button>
          </Row>

          <Row
            n={2}
            title="Call the vendor"
            body={
              vendorPhone
                ? "Talk to dispatch. The reason above is what to tell them."
                : "No dispatch number on file for this vendor."
            }
          >
            {vendorPhone ? (
              <a href={`tel:${vendorPhone}`} className={btn} style={{ background: "var(--secondary)", color: "#FFFFFF" }}>
                Call vendor
              </a>
            ) : (
              <span className="text-[13px] text-[var(--ink-soft)]">Add one in vendor settings.</span>
            )}
          </Row>

          {isPickup ? (
            <Row
              n={3}
              title="Escalate to your DON"
              body="A pickup stays with the company that delivered the equipment — it cannot move to a backup vendor. Escalation is the lever here."
            >
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => escalateOrder(orderId, reason))}
                className={btn}
                style={{ background: "var(--secondary)", color: "#FFFFFF" }}
              >
                Escalate to DON
              </button>
            </Row>
          ) : (
            <Row
              n={3}
              title="Reorder from a backup"
              body={
                backup
                  ? `${backup.name}, arriving ${formatDayTime(backup.etaIso)}, ${
                      backup.perDayDeltaCents === 0
                        ? "same daily price"
                        : `${formatUsd(Math.abs(backup.perDayDeltaCents))}/day ${
                            backup.perDayDeltaCents > 0 ? "more" : "less"
                          }`
                    }. ${
                      backup.meetsDeadline
                        ? "That makes the needed-by time."
                        : "That still misses the needed-by time — it is the closest anyone else gets."
                    } The first order stays open until you cancel it.`
                  : "No other contracted vendor carries this item."
              }
            >
              {backup ? (
                confirmBackup === backup.vendorId ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => reorderToBackup(orderId, backup.vendorId))}
                      className={btn}
                      style={{ background: "var(--salmon)", color: "#24333F" }}
                    >
                      {pending ? "Placing" : "Yes, place it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBackup(null)}
                      className={`${btn} border border-[var(--line)]`}
                    >
                      Go back
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBackup(backup.vendorId)}
                    className={`${btn} border border-[var(--line)]`}
                  >
                    Reorder from backup
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => escalateOrder(orderId, reason))}
                  className={btn}
                  style={{ background: "var(--secondary)", color: "#FFFFFF" }}
                >
                  Escalate to DON
                </button>
              )}
            </Row>
          )}
        </ul>

        {state ? (
          <p
            role="status"
            className="mt-3 text-[13.5px]"
            style={{ color: state.ok ? "var(--ink)" : "var(--burnt-dark)" }}
          >
            {state.message}
          </p>
        ) : null}

        <p className="mt-4 text-[12.5px] text-[var(--ink-soft)]">
          Nothing is cancelled automatically. Every action here waits for your tap.
        </p>

        <button
          type="button"
          onClick={close}
          className="mt-4 min-h-[48px] w-full rounded-[var(--radius-btn)] border border-[var(--line)] text-[13px] font-extrabold uppercase tracking-[0.04em]"
        >
          Close
        </button>
      </section>
    </div>
  );
}
