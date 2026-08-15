"use client";

import { useActionState } from "react";
import {
  BUNDLE_INITIAL_STATE,
  orderAdmissionBundle,
  type BundleActionState,
} from "./actions";

export default function BundleButton({ patientId }: { patientId: string }) {
  const [state, formAction, pending] = useActionState<
    BundleActionState,
    FormData
  >(orderAdmissionBundle, BUNDLE_INITIAL_STATE);

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="patientId" value={patientId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-btn)] px-3 text-[11px] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50"
        style={{ background: "var(--salmon)", color: "#24333F" }}
      >
        {pending ? "Working" : "Order bundle"}
      </button>
      {state.message ? (
        <p className="mt-1 text-[11px] font-normal normal-case text-[var(--ink-soft)]">
          {state.message}
          {state.detail ? <span className="block">{state.detail}</span> : null}
        </p>
      ) : null}
    </form>
  );
}
