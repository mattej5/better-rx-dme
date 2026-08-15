"use server";

import { revalidatePath } from "next/cache";

import {
  changePatientStatus as fanOutPatientStatus,
  type PatientStatusReceipt,
} from "@/src/lib/fanout";
import { getSession } from "@/src/lib/role";

export async function changePatientStatus(
  patientId: string,
  status: "deceased" | "discharged",
): Promise<PatientStatusReceipt> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }
  if (!patientId.trim()) throw new Error("Patient is required");

  const actor = await getSession();
  if (!actor) throw new Error("Sign in to change patient status");
  const receipt = await fanOutPatientStatus(patientId, status, { actor });
  // STUB: T4 will call runRules(orderId) here for every open order re-evaluated by
  // the status change (condition_worsened path) — not wired yet.
  revalidatePath("/", "layout");
  return receipt;
}
