// engine.md §1.3 — POST …/decline → vendor_declined { reason }
//
// §2.3: a decline does NOT auto-reorder and nothing auto-cancels. All this
// endpoint does is record the reason (which feeds the reliability score
// honestly) and, when the stop was a defect redelivery, report that the backup
// gate is now open. Opening the gate is not taking the offer — a human still
// has to confirm, in src/lib/replacement.ts#acceptBackupOffer.
import { computeBackupOffer, isReplacementOrder } from "@/src/lib/replacement";
import type { Json } from "@/src/types/db";

import { text, vendorAction } from "../vendor-token";

export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/decline">) {
  const { token } = await ctx.params;
  return vendorAction(
    token,
    request,
    ({ stop, body }) => {
      const reason = text(body.reason);
      if (!reason) throw new Error("Tell us why so the hospice can plan around it.");
      return {
        events: [
          {
            type: "vendor_declined",
            payload: {
              reason,
              vendor_id: stop.vendorId,
              // No auto-reorder, no auto-cancel. Stated in the log, not just on screen.
              auto_reorder: false,
              auto_cancel: false,
            },
          },
        ],
        echo: { auto_reorder: false },
      };
    },
    async ({ stop }) => {
      if (!isReplacementOrder(stop.order.items)) return {};
      const offer = await computeBackupOffer(stop.order.id);
      return { backup_offer: offer as unknown as Json };
    },
  );
}
