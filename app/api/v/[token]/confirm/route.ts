// engine.md §1.3 — POST …/confirm → vendor_confirmed { eta_iso }
import { isoTime, vendorAction } from "../vendor-token";

export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/confirm">) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ stop, body }) => {
    const etaIso = isoTime(body.eta_iso);
    if (!etaIso) throw new Error("Tell us roughly when you'll be there.");
    return {
      events: [
        {
          type: "vendor_confirmed",
          payload: { eta_iso: etaIso, vendor_id: stop.vendorId, promised_eta: etaIso },
        },
      ],
      orderPatch: { promised_eta: etaIso, current_eta: etaIso },
      echo: { eta_iso: etaIso },
    };
  });
}
