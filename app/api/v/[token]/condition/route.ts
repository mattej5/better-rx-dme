// engine.md §1.3 — POST …/condition → condition_reported
//
// One tap: None / Dirty / Damaged / Not working. Contracts amendment 7 puts the
// phase in the payload rather than adding an event type, so the same route
// serves the vendor's note on returned equipment (`post_delivery`) and the
// condition captured at the door (`delivery`).
//
// The payload keys are exactly the ones derive.ts#conditionScore reads.
import { captureRef, conditionPayload, isConditionValue, text, vendorAction } from "../vendor-token";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v/[token]/condition">,
) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ body, atIso }) => {
    const value = body.condition;
    if (!isConditionValue(value)) {
      throw new Error("Pick one: none, dirty, damaged, or not working.");
    }
    const phase = body.phase === "delivery" ? "delivery" : "post_delivery";
    const photo = captureRef(body.photo_url);

    return {
      events: [
        {
          type: "condition_reported",
          payload: conditionPayload(value, phase, {
            reported_at: atIso,
            photo_url: photo.url,
            capture_stored: photo.stored,
            source: "vendor",
            ...(text(body.note) ? { note: text(body.note) } : {}),
          }),
        },
      ],
      echo: { condition: value, phase },
    };
  });
}
