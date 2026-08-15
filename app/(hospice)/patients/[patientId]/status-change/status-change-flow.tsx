"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import BigActionButton from "@/components/big-action-button";
import { changePatientStatus } from "@/app/actions/patient-status";

type Choice = "deceased" | "discharged";

const CONFIRM_LINE: Record<Choice, (name: string) => string> = {
  deceased: (name) => `Record that ${name} is deceased.`,
  discharged: (name) => `Record that ${name} was discharged.`,
};

export default function StatusChangeFlow({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(status: Choice) {
    setFailed(false);
    startTransition(async () => {
      try {
        await changePatientStatus(patientId, status);
      } catch {
        setFailed(true);
        return;
      }
      router.replace(`/patients/${patientId}/status-change/receipt`);
    });
  }

  return (
    <section className="flex min-h-[70vh] flex-col bg-[var(--paper)]">
      <header>
        <h1
          className="text-[26px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Status change
        </h1>
        <p className="mt-1 text-[15px] text-[var(--ink-soft)]">{patientName}</p>
      </header>

      {choice === null ? (
        <div className="mt-10 flex flex-col gap-4">
          <BigActionButton size="xl" tone="slate" onClick={() => setChoice("deceased")}>
            PATIENT IS DECEASED
          </BigActionButton>
          <BigActionButton size="xl" tone="quiet" onClick={() => setChoice("discharged")}>
            PATIENT DISCHARGED
          </BigActionButton>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-4">
          <p className="text-[19px] leading-snug" style={{ fontFamily: "var(--font-display)" }}>
            {CONFIRM_LINE[choice](patientName)}
          </p>
          <BigActionButton
            size="xl"
            tone="slate"
            disabled={pending}
            onClick={() => submit(choice)}
          >
            {pending ? "NOTIFYING VENDORS" : "CONFIRM"}
          </BigActionButton>
          <BigActionButton
            size="lg"
            tone="quiet"
            disabled={pending}
            onClick={() => {
              setFailed(false);
              setChoice(null);
            }}
          >
            GO BACK
          </BigActionButton>

          {failed ? (
            <div
              role="alert"
              className="rounded-[var(--radius-card)] border p-4"
              style={{ background: "var(--red-tint)", borderColor: "var(--red)" }}
            >
              <p className="text-[15px]">We couldn&apos;t notify the vendors. Try again.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(choice)}
                className="mt-3 min-h-[44px] w-full rounded-[var(--radius-btn)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white disabled:opacity-50"
                style={{ background: "var(--secondary)" }}
              >
                TRY AGAIN
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
