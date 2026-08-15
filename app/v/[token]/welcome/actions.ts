"use server";

import { revalidatePath } from "next/cache";

import { now } from "@/src/lib/clock";
import {
  isPricingModel,
  issueMagicLink,
  loadCatalog,
  resolveToken,
  saveOnboarding,
} from "@/src/lib/magic-link";

export type OnboardingResult =
  | { ok: true; runListPath: string }
  | { ok: false; message: string };

export type OnboardingPayload = {
  inventory: Record<string, number>;
  pricingModel: string;
  serviceCenterZip: string;
  serviceRadiusMiles: number;
};

/**
 * Writes the four vendor columns amendment 11 added: inventory {hcpcs: qty},
 * pricing_model, service_center_zip, service_radius_miles. The radius is the
 * vendor's own number — we never infer how far someone is willing to drive.
 */
export async function submitOnboarding(
  token: string,
  payload: OnboardingPayload,
): Promise<OnboardingResult> {
  const clock = await now();
  const resolved = await resolveToken(token, clock);
  if (resolved.status === "expired") {
    return { ok: false, message: "This link has expired. Ask the hospice for a new one." };
  }
  if (resolved.status !== "ok") {
    return { ok: false, message: "We couldn't check this link. Try opening it again." };
  }
  const { link } = resolved;

  if (link.source === "fixture") {
    return {
      ok: false,
      message:
        "Nothing was saved — this environment has no database connection. Your answers are still on screen.",
    };
  }

  if (!isPricingModel(payload.pricingModel)) {
    return { ok: false, message: "Pick how you bill." };
  }

  const catalog = await loadCatalog(link.source);
  if (!catalog.ok) {
    return { ok: false, message: "We couldn't load the equipment list. Try again." };
  }

  const saved = await saveOnboarding(
    link.vendor.id,
    {
      inventory: payload.inventory,
      pricingModel: payload.pricingModel,
      serviceCenterZip: payload.serviceCenterZip.trim(),
      serviceRadiusMiles: payload.serviceRadiusMiles,
    },
    catalog.rows,
  );
  if (!saved.ok) return { ok: false, message: saved.message };

  // The onboarding token stays scoped to onboarding, so hand back a run-list link.
  let runListPath = `/v/${link.token}`;
  try {
    const issued = await issueMagicLink(
      { vendorId: link.vendor.id, scope: "run_list" },
      clock,
    );
    runListPath = issued.path;
  } catch {
    // Falls back to the onboarding token, which lands back here. Non-fatal.
  }

  revalidatePath(`/v/${link.token}/welcome`);
  return { ok: true, runListPath };
}
