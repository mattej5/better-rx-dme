export const SETTING_DEFAULTS = {
  don_threshold_cents: 50_000,
  lead_time_hours: { stat: 4, admission: 24, routine: 48 },
  silence_minutes: { stat: 30, admission: 120, routine: 480 },
  pickup_amber_h: 24,
  pickup_red_h: 48,
  baseline_notify_lag_h: 26,
  high_risk_buffer_h: 2,
  eta_amber_margin_min: 60,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingsValues = {
  don_threshold_cents: number;
  lead_time_hours: { stat: number; admission: number; routine: number };
  silence_minutes: { stat: number; admission: number; routine: number };
  pickup_amber_h: number;
  pickup_red_h: number;
  baseline_notify_lag_h: number;
  high_risk_buffer_h: number;
  eta_amber_margin_min: number;
};
