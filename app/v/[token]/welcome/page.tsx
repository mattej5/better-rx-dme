// N12 — vendor onboarding v2. Two screens, one confirm, zero login. Writes the
// vendors columns contracts amendment 11 added (inventory / pricing_model /
// service_center_zip / service_radius_miles).
import { AssumedLabel } from "@/components/labels";
import { now } from "@/src/lib/clock";
import { categoryLabel, loadCatalog, resolveToken } from "@/src/lib/magic-link";
import LinkClosed from "../link-state";
import OnboardingForm from "./onboarding-form";
import type { CatalogItem, CategoryOption } from "./onboarding-form";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["bed", "respiratory", "mobility", "transfer", "consumable"];

function inventoryOf(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [hcpcs, qty] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof qty === "number" && Number.isFinite(qty) && qty > 0) {
      out[hcpcs] = Math.floor(qty);
    }
  }
  return out;
}

export default async function VendorWelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const clock = await now();
  const resolved = await resolveToken(token, clock);
  if (resolved.status !== "ok") return <LinkClosed status={resolved.status} />;
  const { link } = resolved;

  const catalog = await loadCatalog(link.source);
  if (!catalog.ok) {
    return (
      <section className="pt-10">
        <h1
          className="text-[24px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          We couldn&rsquo;t load the equipment list
        </h1>
        <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
          Your link is fine. Open it again in a moment.
        </p>
      </section>
    );
  }

  const items: CatalogItem[] = catalog.rows.map((row) => ({
    hcpcs: row.hcpcs,
    plainName: row.plain_name,
    category: row.category,
  }));

  const present = [...new Set(items.map((i) => i.category))];
  const categories: CategoryOption[] = [
    ...CATEGORY_ORDER.filter((key) => present.includes(key)),
    ...present.filter((key) => !CATEGORY_ORDER.includes(key)),
  ].map((key) => ({ key, label: categoryLabel(key) }));

  const inventory = inventoryOf(link.vendor.inventory);
  const initialCategories = link.vendor.categories.length
    ? link.vendor.categories
    : Object.keys(inventory).length
      ? [...new Set(items.filter((i) => inventory[i.hcpcs] > 0).map((i) => i.category))]
      : [];

  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
        {link.vendor.name}
      </p>
      <h1
        className="mt-1 text-[24px] leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Set up your equipment list
      </h1>
      <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
        Check the items you stock and set your service area. Hospices will only send
        you orders you can fill.
      </p>

      <div className="mt-5">
        <OnboardingForm
          token={link.token}
          items={items}
          categories={categories}
          initialInventory={inventory}
          initialCategories={initialCategories}
          initialPricingModel={link.vendor.pricing_model}
          initialZip={link.vendor.service_center_zip ?? ""}
          initialRadius={link.vendor.service_radius_miles}
        />
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <AssumedLabel>
          Quantities are a starting point, not a commitment
        </AssumedLabel>
      </div>
    </section>
  );
}
