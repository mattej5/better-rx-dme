import "server-only";
import type { Json } from "@/src/types/db";
import { SETTING_DEFAULTS } from "@/src/lib/settings-defaults";
import type {
  SettingKey,
  SettingsValues,
} from "@/src/lib/settings-defaults";

export { SETTING_DEFAULTS };
export type { SettingKey, SettingsValues };

export type LoadedSettings = {
  editable: boolean;
  message?: string;
  persisted: Set<SettingKey>;
  values: SettingsValues;
};

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function urgencyValues(
  value: Json,
): { stat: number; admission: number; routine: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, Json | undefined>;
  if (
    !isNumber(record.stat) ||
    !isNumber(record.admission) ||
    !isNumber(record.routine)
  ) {
    return null;
  }
  return {
    stat: record.stat,
    admission: record.admission,
    routine: record.routine,
  };
}

function defaults(): SettingsValues {
  return {
    don_threshold_cents: SETTING_DEFAULTS.don_threshold_cents,
    lead_time_hours: { ...SETTING_DEFAULTS.lead_time_hours },
    silence_minutes: { ...SETTING_DEFAULTS.silence_minutes },
    pickup_amber_h: SETTING_DEFAULTS.pickup_amber_h,
    pickup_red_h: SETTING_DEFAULTS.pickup_red_h,
    baseline_notify_lag_h: SETTING_DEFAULTS.baseline_notify_lag_h,
    high_risk_buffer_h: SETTING_DEFAULTS.high_risk_buffer_h,
    eta_amber_margin_min: SETTING_DEFAULTS.eta_amber_margin_min,
  };
}

export async function loadSettings(): Promise<LoadedSettings> {
  const values = defaults();
  const persisted = new Set<SettingKey>();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      editable: false,
      message: "Supabase key not set. Showing defaults.",
      persisted,
      values,
    };
  }
  if (!process.env.SUPABASE_URL) {
    return {
      editable: false,
      message: "Supabase URL not set. Showing defaults.",
      persisted,
      values,
    };
  }

  try {
    const { supabase } = await import("@/src/lib/supabase");
    const result = await supabase.from("settings").select("key, value");
    if (result.error) {
      return {
        editable: false,
        message: "Settings unavailable. Showing defaults.",
        persisted,
        values,
      };
    }

    for (const row of result.data ?? []) {
      if (!SETTING_KEYS.includes(row.key as SettingKey)) continue;
      const key = row.key as SettingKey;
      if (key === "lead_time_hours" || key === "silence_minutes") {
        const parsed = urgencyValues(row.value);
        if (parsed) {
          values[key] = parsed;
          persisted.add(key);
        }
      } else if (isNumber(row.value)) {
        values[key] = row.value;
        persisted.add(key);
      }
    }

    return { editable: true, persisted, values };
  } catch {
    return {
      editable: false,
      message: "Settings unavailable. Showing defaults.",
      persisted,
      values,
    };
  }
}
