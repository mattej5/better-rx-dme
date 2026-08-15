// engine.md §1.3 — POST …/delivered → delivered { pod_photo_url, signature_name, delivered_at }
//
// POD rides on this payload. There is no `pod_captured` event in the pinned
// union (§8 lists it as deliberately-not-an-event) and this route does not
// invent one.
//
// Proof-of-capture rule: signature (typed name or drawn) OR a photo, PLUS a
// timestamp, always. A completion with neither is refused here, not just
// disabled in the UI, so the rule survives a curl.
import { assertProofOfCapture, captureRef, text, vendorAction } from "../vendor-token";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v/[token]/delivered">,
) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ body, atIso }) => {
    const signatureName = text(body.signature_name);
    const signature = captureRef(body.signature_image_url);
    const photo = captureRef(body.pod_photo_url);
    assertProofOfCapture({
      signatureName,
      signatureImageUrl: signature.url,
      photoUrl: photo.url,
      atIso,
    });

    const swapEmpties =
      typeof body.empties_retrieved === "number" && Number.isFinite(body.empties_retrieved)
        ? Math.max(0, Math.round(body.empties_retrieved))
        : null;

    return {
      events: [
        {
          type: "delivered",
          payload: {
            pod_photo_url: photo.url,
            signature_name: signatureName,
            signature_image_url: signature.url,
            // The timestamp is never optional.
            delivered_at: atIso,
            capture_stored: photo.stored || signature.stored,
            ...(photo.note || signature.note
              ? { capture_note: photo.note ?? signature.note ?? null }
              : {}),
            // An oxygen swap is ONE stop: full cylinders left, empties taken.
            // It stays a single `delivered` event — taking the empties is not a
            // `picked_up`, which would end the rental.
            ...(swapEmpties !== null
              ? { swap: true, empties_retrieved: swapEmpties, full_delivered: true }
              : {}),
            ...(text(body.note) ? { note: text(body.note) } : {}),
          },
        },
      ],
      orderPatch: { delivered_at: atIso },
      echo: { delivered_at: atIso, capture_stored: photo.stored || signature.stored },
    };
  });
}
