/**
 * Turning a `ParseResult` into order events — the write half of the parse loop.
 *
 * Split out of the nurse-facing confirm action so the automatic path (a vendor
 * reply that clears the confidence gate) and the human path (a nurse tapping to
 * accept a low-confidence interpretation) cannot drift into two different
 * readings of the same reply.
 *
 * The gate itself is NOT re-implemented here: callers ask `canActOnParse()` and
 * pass the answer in as `humanConfirmed`. This function only writes.
 */

import { appendEvent, type Actor } from "./events.ts";
import { canActOnParse, type ParseResult } from "./parse-vendor-reply.ts";

export type ApplyParseOutcome =
  | { applied: true; events: string[] }
  | { applied: false; reason: string };

export async function applyParsedIntent(input: {
  orderId: string;
  vendorId: string | null;
  messageId: string | null;
  result: ParseResult;
  actor: Actor;
  /** True when a person accepted this interpretation rather than the gate passing it. */
  humanConfirmed: boolean;
}): Promise<ApplyParseOutcome> {
  const { orderId, result, actor } = input;

  const shared = {
    vendor_id: input.vendorId,
    message_id: input.messageId,
    human_confirmed: input.humanConfirmed,
    ...(input.humanConfirmed ? { confirmed_by: actor.userName } : {}),
    parse_confidence: result.confidence,
    parse_method: result.method,
    // Records which side of the gate this event came from, either way.
    auto_actionable: canActOnParse(result),
  };

  if (result.intent === "confirm") {
    await appendEvent(
      orderId,
      "vendor_confirmed",
      { ...shared, ...(result.eta ? { promised_eta: result.eta } : {}) },
      actor,
    );
    if (result.eta) {
      await appendEvent(orderId, "eta_updated", { ...shared, eta: result.eta, source: "vendor" }, actor);
      return { applied: true, events: ["vendor_confirmed", "eta_updated"] };
    }
    return { applied: true, events: ["vendor_confirmed"] };
  }

  if (result.intent === "eta" || result.intent === "delay") {
    if (!result.eta) {
      return { applied: false, reason: "There is no clear time in that reply. Call the vendor." };
    }
    await appendEvent(orderId, "eta_updated", { ...shared, eta: result.eta, source: "vendor" }, actor);
    return { applied: true, events: ["eta_updated"] };
  }

  if (result.intent === "decline") {
    await appendEvent(
      orderId,
      "vendor_declined",
      { ...shared, reason: result.reason ?? "Vendor replied that they cannot take it" },
      actor,
    );
    return { applied: true, events: ["vendor_declined"] };
  }

  return {
    applied: false,
    reason: "That reply doesn't change anything on its own. Call the vendor.",
  };
}
