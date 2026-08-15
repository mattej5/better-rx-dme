// engine.md §1.3 — POST …/eta → eta_updated { eta_iso, source: 'vendor' }
//
// This is the PRIMARY status signal (00-contracts.md, staged-status model): the
// driver saying when they will be there. GPS only refines it later.
import { finite, isoTime, vendorAction } from "../vendor-token";

export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/eta">) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ body, at }) => {
    const minutes = finite(body.minutes);
    const etaIso =
      isoTime(body.eta_iso) ??
      (minutes !== null && minutes >= 0
        ? new Date(at.getTime() + minutes * 60_000).toISOString()
        : null);
    if (!etaIso) throw new Error("Give us a time or a number of minutes.");
    return {
      events: [
        {
          type: "eta_updated",
          payload: {
            eta_iso: etaIso,
            // derive.ts reads `eta` on some chains and the seed writes `eta`;
            // write both so ETA accuracy scoring sees this event.
            eta: etaIso,
            source: "vendor",
          },
        },
      ],
      orderPatch: { current_eta: etaIso },
      echo: { eta_iso: etaIso },
    };
  });
}
