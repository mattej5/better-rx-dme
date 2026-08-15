import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/empty-state";
import PollRefresh from "@/components/poll-refresh";
import RiskBanner from "@/components/risk-banner";
import { AssumedLabel, SyntheticLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { getSession } from "@/src/lib/role";
import RetryCard from "../today/retry-card";
import BundleButton from "./bundle-button";
import { loadReadiness, type Cell, type CellTone, type ReadinessRow } from "./data";

export const dynamic = "force-dynamic";

const TONE_STYLE: Record<CellTone, { bg: string; fg: string }> = {
  green: { bg: "var(--green-tint)", fg: "#4A7D33" },
  amber: { bg: "var(--burnt-tint)", fg: "var(--burnt-dark)" },
  red: { bg: "var(--red-tint)", fg: "#B4322A" },
  none: { bg: "var(--paper-alt)", fg: "var(--ink-soft)" },
};

function CellBox({ cell }: { cell: Cell }) {
  const style = TONE_STYLE[cell.tone];
  const body = (
    <span
      className="block rounded-[var(--radius-card)] px-2 py-2"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="block text-[11px] font-bold uppercase tracking-[0.04em]">
        {cell.label}
      </span>
      {cell.when ? (
        <span className="mt-0.5 block text-[11px] font-normal text-[var(--ink-soft)]">
          {cell.when}
        </span>
      ) : null}
    </span>
  );
  return cell.orderId ? (
    <Link href={`/orders/${cell.orderId}`} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Legend() {
  const items: { tone: CellTone; text: string }[] = [
    { tone: "green", text: "On track" },
    { tone: "amber", text: "Due soon" },
    { tone: "red", text: "At risk" },
    { tone: "none", text: "Not ordered" },
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.tone}
          className="rounded-[var(--radius-badge)] px-2 py-[2px] text-[10.8px] font-bold uppercase tracking-[0.05em]"
          style={{
            background: TONE_STYLE[item.tone].bg,
            color: TONE_STYLE[item.tone].fg,
          }}
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}

function Row({ row }: { row: ReadinessRow }) {
  return (
    <tr className="align-top">
      <th
        scope="row"
        className="sticky left-0 z-[1] w-[150px] min-w-[150px] border-b border-[var(--line)] bg-[var(--paper)] py-3 pr-3 text-left font-normal"
      >
        <Link
          href={`/patients/${row.patient.id}`}
          className="block text-[15px] font-semibold leading-tight text-[var(--ink)]"
        >
          {row.patient.first_name} {row.patient.last_name}
        </Link>
        <span className="mt-0.5 block text-[12px] text-[var(--ink-soft)]">
          {row.note}
        </span>
        <span className="block text-[12px] text-[var(--ink-soft)]">
          {row.openCount} open {row.openCount === 1 ? "order" : "orders"}
        </span>
        <BundleButton patientId={row.patient.id} />
      </th>
      {row.cells.map((cell) => (
        <td
          key={cell.hcpcs}
          className="w-[116px] min-w-[116px] border-b border-[var(--line)] py-3 pr-2"
        >
          <CellBox cell={cell} />
        </td>
      ))}
    </tr>
  );
}

export default async function ReadinessPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const at = await now();
  const result = await loadReadiness(at);

  return (
    <section>
      <PollRefresh intervalMs={5000} />
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Readiness
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        Every admission and discharge, item by item.
      </p>

      {!result.ok ? (
        <div className="mt-4">
          {result.reason === "no-env" ? (
            <EmptyState message="Supabase key not set. Data appears after setup." />
          ) : (
            <RetryCard />
          )}
        </div>
      ) : result.data.rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            message="No admissions or discharges to track."
            actionLabel="See patients"
            actionHref="/patients"
          />
        </div>
      ) : (
        <>
          {result.data.rows
            .filter((row) => row.blocked)
            .map((row) => (
              <div key={row.patient.id} className="mt-4">
                <RiskBanner
                  title="Discharge blocked risk"
                  reason={`${row.patient.first_name} ${row.patient.last_name}: ${row.blocked!.reason}`}
                  actionLabel="See options"
                  actionHref={`/orders/${row.blocked!.orderId}?sheet=escalate`}
                />
              </div>
            ))}

          <Legend />

          <div className="mt-3 overflow-x-auto">
            <table className="w-max border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-[1] w-[150px] min-w-[150px] border-b border-[var(--line)] bg-[var(--paper)] pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-soft)]"
                  >
                    Patient
                  </th>
                  {result.data.columns.map((column) => (
                    <th
                      scope="col"
                      key={column.hcpcs}
                      className="w-[116px] min-w-[116px] border-b border-[var(--line)] pb-2 pr-2 text-left"
                    >
                      <span className="block text-[12px] font-semibold leading-tight text-[var(--ink)]">
                        {column.plainName}
                      </span>
                      <span className="block text-[10.5px] text-[var(--ink-soft)]">
                        {column.hcpcs}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.rows.map((row) => (
                  <Row key={row.patient.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
            <SyntheticLabel />
            <AssumedLabel>
              Due soon = {result.data.amberMarginMin} minutes
            </AssumedLabel>
          </p>
        </>
      )}
    </section>
  );
}
