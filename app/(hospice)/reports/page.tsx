import Link from "next/link";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import type { ScoreBreakdown } from "@/src/lib/derive";
import { ASSUMED_DAYS_PER_MONTH, formatUsd } from "@/src/lib/domain";
import WideColumn from "../wide-column";
import { loadReports, type ReportsData, type VendorScorecard } from "./data";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ppd", label: "DME PPD" },
  { key: "vendors", label: "Vendors" },
  { key: "saved", label: "Days saved" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTab(value: string | undefined): value is TabKey {
  return value === "ppd" || value === "vendors" || value === "saved";
}

function Tile({
  label,
  value,
  sub,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p
        className="mt-1 text-[26px] leading-none text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{sub}</p>
      ) : null}
      {note ? <p className="mt-1">{note}</p> : null}
    </div>
  );
}

function Tabs({ active }: { active: TabKey }) {
  return (
    <nav className="mt-4 flex gap-2 overflow-x-auto">
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/reports?tab=${tab.key}`}
            replace
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-btn)] border px-4 text-[13px] font-extrabold uppercase tracking-[0.04em]"
            style={
              on
                ? { background: "var(--salmon)", borderColor: "var(--salmon)", color: "#24333F" }
                : { borderColor: "var(--line)", color: "var(--ink)" }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PpdTab({ data }: { data: ReportsData }) {
  if (data.patients.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState message="No patients on service this month." />
      </div>
    );
  }

  return (
    <>
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="DME PPD"
          value={data.ppdCents === null ? "No data" : formatUsd(data.ppdCents)}
          sub={`${formatUsd(data.spendCents)} over ${data.censusDays} patient-days`}
        />
        <Tile
          label="Med PPD"
          value={formatUsd(data.medPpdCents)}
          sub={data.medPpdFromSettings ? "From settings" : "Seeded constant"}
          note={<SyntheticLabel>Sample comparison</SyntheticLabel>}
        />
        <div className="hidden lg:flex">
          <Tile
            label="Month spend"
            value={formatUsd(data.spendCents)}
            sub={`${data.patients.length} ${data.patients.length === 1 ? "patient" : "patients"} on service`}
          />
        </div>
      </section>

      <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
        Spend accrues daily at the monthly rental price divided by {ASSUMED_DAYS_PER_MONTH}.{" "}
        <AssumedLabel />
      </p>
      {data.ordersExcludedNoPrice > 0 ? (
        <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
          {data.ordersExcludedNoPrice}{" "}
          {data.ordersExcludedNoPrice === 1 ? "order" : "orders"} excluded. No price on
          file.
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]" style={{ boxShadow: "var(--shadow)" }}>
        <table className="w-full min-w-[420px] border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
              <th scope="col" className="border-b border-[var(--line)] bg-[var(--paper-alt)] px-4 py-2.5">Patient</th>
              <th scope="col" className="border-b border-[var(--line)] bg-[var(--paper-alt)] px-3 py-2.5 text-right">Days</th>
              <th scope="col" className="border-b border-[var(--line)] bg-[var(--paper-alt)] px-3 py-2.5 text-right">DME spend</th>
              <th scope="col" className="border-b border-[var(--line)] bg-[var(--paper-alt)] px-4 py-2.5 text-right">PPD</th>
            </tr>
          </thead>
          <tbody>
            {data.patients.map((row, i) => (
              <tr
                key={row.patientId}
                className={i > 0 ? "border-t border-[var(--line)]" : undefined}
                style={i % 2 === 1 ? { background: "var(--paper)" } : undefined}
              >
                <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{row.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink-soft)]">{row.censusDays}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink)]">{formatUsd(row.spendCents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[var(--ink)]">
                  {row.ppdCents === null ? "No data" : formatUsd(row.ppdCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
        Census days count admission and discharge days both.
      </p>
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: ScoreBreakdown[] }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
        {title}
      </p>
      <table className="mt-2 w-full border-collapse text-[13px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[var(--line)]">
              <td className="py-1.5 pr-3 text-[var(--ink)]">{row.label}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--ink)]">
                {row.value === null ? "No data" : row.value}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--ink-soft)]">
                {Math.round(row.weight * 100)}% weight, {row.n} counted
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorRow({ vendor }: { vendor: VendorScorecard }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
        {vendor.name}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
        {vendor.orders} {vendor.orders === 1 ? "order" : "orders"}
      </p>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
            On time
          </p>
          <p className="text-[15px] font-semibold text-[var(--ink)]">
            {vendor.reliability.score === null
              ? vendor.reliability.label
              : `${vendor.reliability.score}%`}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]">
            Condition
          </p>
          <p className="text-[15px] font-semibold text-[var(--ink)]">
            {vendor.condition.score === null
              ? vendor.condition.label
              : `${vendor.condition.score}%`}
          </p>
        </div>
      </div>
      <div className="mt-4 hidden border-t border-[var(--line)] pt-3 lg:flex lg:flex-col lg:gap-4">
        <Breakdown title="On time, by variable" rows={vendor.reliability.breakdown} />
        <Breakdown title="Condition, by variable" rows={vendor.condition.breakdown} />
      </div>
      <p className="mt-2">
        <SyntheticLabel>Sample data</SyntheticLabel>
      </p>
    </div>
  );
}

function VendorsTab({ data }: { data: ReportsData }) {
  if (data.vendors.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState message="No vendors yet." />
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      {data.vendors.map((vendor) => (
        <VendorRow key={vendor.vendorId} vendor={vendor} />
      ))}
    </div>
  );
}

// Billing clock: src/lib/billing.ts, equipmentDaysSaved() (specs/engine.md §4).
function SavedTab({ data }: { data: ReportsData }) {
  const { saved, baselineNotifyLagH } = data;
  const noQualifyingOrders = saved.n_orders === 0;

  return (
    <>
      <section className="mt-5 flex gap-3">
        <Tile
          label="Rental days after death avoided"
          value={noQualifyingOrders ? "0" : saved.daysSaved.toFixed(1)}
          sub={`${saved.n_orders} ${saved.n_orders === 1 ? "order" : "orders"} counted`}
        />
        <Tile
          label="Not billed"
          value={noQualifyingOrders ? "$0" : formatUsd(saved.dollarsSavedCents)}
          sub={`${saved.n_orders} ${saved.n_orders === 1 ? "order" : "orders"} counted`}
        />
      </section>
      {noQualifyingOrders ? (
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
          No qualifying orders yet. This fills in once a patient status change is
          followed by a pickup request.
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
        Compared to a {baselineNotifyLagH}-hour phone-and-fax baseline. Default estimate.
      </p>
    </>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [params, at] = await Promise.all([searchParams, now()]);
  const active: TabKey = isTab(params.tab) ? params.tab : "ppd";
  const result = await loadReports(at);

  return (
    <WideColumn>
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Reports
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {!result.ok
          ? "Cost, vendors, and days saved."
          : active === "vendors"
            ? "Cost, vendors, and days saved."
            : result.data.monthLabel}
      </p>

      <Tabs active={active} />

      {!result.ok ? (
        <div className="mt-5">
          <EmptyState
            message={
              result.reason === "no-env"
                ? "Supabase key not set. Reports appear after setup."
                : "We couldn't load reports. Try again."
            }
          />
        </div>
      ) : active === "vendors" ? (
        <VendorsTab data={result.data} />
      ) : active === "saved" ? (
        <SavedTab data={result.data} />
      ) : (
        <PpdTab data={result.data} />
      )}
    </section>
    </WideColumn>
  );
}
