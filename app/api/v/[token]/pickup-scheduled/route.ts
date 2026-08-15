// engine.md §1.3 — POST …/pickup-scheduled → pickup_scheduled { window_start, window_end, family_note? }
//
// This does NOT stop the billing clock. §4 pins the clock stop at
// `pickup_requested` — the hospice's notification — and scheduling is the
// vendor's own timeliness signal.
import { isoTime, text, vendorAction } from "../vendor-token";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v/[token]/pickup-scheduled">,
) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ body, at }) => {
    const windowStart = isoTime(body.window_start);
    if (!windowStart) throw new Error("Pick a day and time you can be there.");
    const windowEnd =
      isoTime(body.window_end) ??
      new Date(Date.parse(windowStart) + 2 * 3_600_000).toISOString();
    if (Date.parse(windowEnd) <= Date.parse(windowStart)) {
      throw new Error("The end of the window has to come after the start.");
    }

    return {
      events: [
        {
          type: "pickup_scheduled",
          payload: {
            window_start: windowStart,
            window_end: windowEnd,
            family_note: text(body.family_note),
            scheduled_at: at.toISOString(),
          },
        },
      ],
      orderPatch: { pickup_scheduled_at: windowStart },
      echo: { window_start: windowStart, window_end: windowEnd },
    };
  });
}
