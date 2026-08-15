import { formatUsd, perDayCents } from "@/src/lib/domain";
import { AssumedLabel } from "@/components/labels";

export type ApprovalInterstitialProps = {
  vendorName: string;
  /** Monthly rental cents for the chosen vendor. */
  price: number;
  /** Monthly rental cents for the cheapest vendor that met the deadline. */
  cheapestPrice: number;
  cheapestVendorName: string;
  approverName?: string;
  orderNo: string;
};

export default function ApprovalInterstitial({
  vendorName,
  price,
  cheapestPrice,
  cheapestVendorName,
  approverName,
  orderNo,
}: ApprovalInterstitialProps) {
  const deltaPerDay = perDayCents(price) - perDayCents(cheapestPrice);

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <h2
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Sent to your DON for approval
      </h2>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        {orderNo} · {vendorName}
        {approverName ? ` · waiting on ${approverName}` : ""}
      </p>

      <p className="mt-3 text-[14.5px]">
        {deltaPerDay === 0
          ? `Same daily price as ${cheapestVendorName}, the cheapest option.`
          : `${formatUsd(perDayCents(price))}/day, ${formatUsd(Math.abs(deltaPerDay))}/day ${
              deltaPerDay > 0 ? "more" : "less"
            } than ${cheapestVendorName} at ${formatUsd(perDayCents(cheapestPrice))}/day.`}
      </p>
      <div className="mt-1">
        <AssumedLabel>Estimated as monthly price ÷ 30</AssumedLabel>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
          What happens next
        </p>
        <ol className="mt-1 list-decimal pl-5 text-[14px]">
          <li>Your DON sees this in the approvals queue.</li>
          <li>The vendor is notified as soon as it is approved.</li>
          <li>You get a status update on the order page.</li>
        </ol>
      </div>
    </section>
  );
}
