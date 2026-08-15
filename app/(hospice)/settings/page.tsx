import SettingsForm from "./settings-form";
import { loadSettings } from "./data";

export default async function SettingsPage() {
  const settings = await loadSettings();

  return (
    <section>
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Settings
      </h1>
      <p className="mt-1 text-[14px] leading-5 text-ink-soft">
        Approval, delivery, response, and pickup guardrails.
      </p>

      {settings.message ? (
        <div
          role="status"
          className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-alt)] px-4 py-3 text-[13px] font-semibold leading-5 text-[var(--ink)]"
        >
          {settings.message}
        </div>
      ) : null}

      <SettingsForm
        editable={settings.editable}
        persisted={[...settings.persisted]}
        values={settings.values}
      />
    </section>
  );
}
