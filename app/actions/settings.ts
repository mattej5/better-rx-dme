"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/src/types/db";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

function numberFrom(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function saveSettings(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  let state: SettingsActionState;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    state = { ok: false, message: "Supabase key not set" };
  } else if (!process.env.SUPABASE_URL) {
    state = { ok: false, message: "Supabase URL not set" };
  } else {
    const dollars = numberFrom(formData, "don_threshold_dollars");
    const leadStat = numberFrom(formData, "lead_time_stat");
    const leadAdmission = numberFrom(formData, "lead_time_admission");
    const leadRoutine = numberFrom(formData, "lead_time_routine");
    const silenceStat = numberFrom(formData, "silence_stat");
    const silenceAdmission = numberFrom(formData, "silence_admission");
    const silenceRoutine = numberFrom(formData, "silence_routine");
    const pickupAmber = numberFrom(formData, "pickup_amber_h");
    const pickupRed = numberFrom(formData, "pickup_red_h");
    const baselineLag = numberFrom(formData, "baseline_notify_lag_h");
    const highRiskBuffer = numberFrom(formData, "high_risk_buffer_h");
    const etaAmberMargin = numberFrom(formData, "eta_amber_margin_min");
    const values = [
      dollars,
      leadStat,
      leadAdmission,
      leadRoutine,
      silenceStat,
      silenceAdmission,
      silenceRoutine,
      pickupAmber,
      pickupRed,
      baselineLag,
      highRiskBuffer,
      etaAmberMargin,
    ];

    if (values.some((value) => value === null)) {
      state = { ok: false, message: "Enter a valid value for every setting" };
    } else if (pickupRed! < pickupAmber!) {
      state = {
        ok: false,
        message: "Red pickup warning must be after amber",
      };
    } else {
      const rows: { key: string; value: Json }[] = [
        { key: "don_threshold_cents", value: Math.round(dollars! * 100) },
        {
          key: "lead_time_hours",
          value: {
            stat: leadStat!,
            admission: leadAdmission!,
            routine: leadRoutine!,
          },
        },
        {
          key: "silence_minutes",
          value: {
            stat: silenceStat!,
            admission: silenceAdmission!,
            routine: silenceRoutine!,
          },
        },
        { key: "pickup_amber_h", value: pickupAmber! },
        { key: "pickup_red_h", value: pickupRed! },
        { key: "baseline_notify_lag_h", value: baselineLag! },
        { key: "high_risk_buffer_h", value: highRiskBuffer! },
        { key: "eta_amber_margin_min", value: etaAmberMargin! },
      ];

      try {
        const { supabase } = await import("@/src/lib/supabase");
        const result = await supabase.from("settings").upsert(rows);
        state = result.error
          ? { ok: false, message: "Settings could not be saved" }
          : { ok: true, message: "Changes saved" };
      } catch {
        state = { ok: false, message: "Settings could not be saved" };
      }
    }
  }

  revalidatePath("/settings");
  return state;
}
