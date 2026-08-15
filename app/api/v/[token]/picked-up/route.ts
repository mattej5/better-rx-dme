// engine.md §1.3 — POST …/picked-up → picked_up { condition_photo_url }
//
// A pickup needs a condition photo. That photo is the vendor's own protection
// as much as the hospice's: it is the record of what the equipment looked like
// leaving the home. Refused server-side, not merely disabled in the UI.
//
// Proof-of-capture rule holds here too: photo (required) PLUS the timestamp.
import { assertProofOfCapture, captureRef, text, vendorAction } from "../vendor-token";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v/[token]/picked-up">,
) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ body, atIso }) => {
    const photo = captureRef(body.condition_photo_url);
    assertProofOfCapture({ photoUrl: photo.url, atIso }, { requirePhoto: true });
    return {
      events: [
        {
          type: "picked_up",
          payload: {
            condition_photo_url: photo.url,
            picked_up_at: atIso,
            capture_stored: photo.stored,
            ...(photo.note ? { capture_note: photo.note } : {}),
            ...(text(body.note) ? { note: text(body.note) } : {}),
          },
        },
      ],
      orderPatch: { picked_up_at: atIso },
      echo: { picked_up_at: atIso },
    };
  });
}
