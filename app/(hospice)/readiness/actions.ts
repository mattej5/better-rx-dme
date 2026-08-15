"use server";

import { revalidatePath } from "next/cache";
import { ADMISSION_BUNDLE } from "./data";

export type BundleActionState = {
  ok: boolean;
  message: string;
  detail?: string;
};

export const BUNDLE_INITIAL_STATE: BundleActionState = { ok: false, message: "" };

// STUB — N9 owns placeOrder(). This writes no orders and no events.
// Per contracts amendment 3 the real action creates ONE ORDER PER ITEM (no bundle_id);
// the resulting orders are grouped in the UI by their shared placement time.
export async function orderAdmissionBundle(
  _previousState: BundleActionState,
  formData: FormData,
): Promise<BundleActionState> {
  const patientId = String(formData.get("patientId") ?? "").trim();
  const state: BundleActionState = patientId
    ? {
        ok: false,
        message: "Ordering isn't wired up yet. Nothing was written.",
        detail: `Would create ${ADMISSION_BUNDLE.length} orders, one per item: ${ADMISSION_BUNDLE.map((i) => i.plainName).join(", ")}.`,
      }
    : { ok: false, message: "Pick a patient first" };

  revalidatePath("/readiness");
  return state;
}
