// engine.md §1.3 — POST …/gps → gps_opted_in, then eta_updated.
// The only endpoint that appends two events, and the spec says so explicitly.
//
// GPS is a SUPPORTING signal (00-contracts.md). A raw driver location without
// route position cannot tell you where they are in their day, so this refines
// an ETA the driver already gave and never replaces it. When the destination
// has no coordinates the refinement is impossible and the payload says so
// rather than inventing a number.
import type { Json } from "@/src/types/db";

import {
  ASSUMED_DRIVE_SPEED_MPH,
  destinationCoords,
  finite,
  haversineMiles,
  isoTime,
  vendorAction,
} from "../vendor-token";

function latestVendorEta(events: { type: string; payload: unknown }[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type !== "eta_updated" && event.type !== "vendor_confirmed") continue;
    const payload =
      event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : {};
    const raw = payload.eta_iso ?? payload.eta ?? payload.promised_eta;
    const iso = isoTime(raw);
    if (iso) return iso;
  }
  return null;
}

export async function POST(request: Request, ctx: RouteContext<"/api/v/[token]/gps">) {
  const { token } = await ctx.params;
  return vendorAction(token, request, ({ stop, body, at }) => {
    const lat = finite(body.lat);
    const lng = finite(body.lng);
    if (lat === null || lng === null) throw new Error("We didn't get a location.");

    const destination = destinationCoords(stop.patient.address);
    const carriedEta = latestVendorEta(stop.events) ?? stop.order.current_eta;

    let etaIso: string;
    const etaPayload: Record<string, Json> = { source: "gps" };
    if (destination) {
      const miles = haversineMiles({ lat, lng }, destination);
      const minutes = Math.max(1, Math.round((miles / ASSUMED_DRIVE_SPEED_MPH) * 60));
      etaIso = new Date(at.getTime() + minutes * 60_000).toISOString();
      etaPayload.refined = true;
      etaPayload.straight_line_miles = Math.round(miles * 10) / 10;
      etaPayload.assumed_speed_mph = ASSUMED_DRIVE_SPEED_MPH;
      etaPayload.method = "haversine";
    } else {
      if (!carriedEta) {
        throw new Error("Send your ETA first, then share your location.");
      }
      etaIso = carriedEta;
      etaPayload.refined = false;
      etaPayload.method = "carried_forward";
      etaPayload.note =
        "The delivery address has no coordinates, so location could not refine the ETA.";
    }

    return {
      events: [
        {
          type: "gps_opted_in",
          payload: {
            lat,
            lng,
            accuracy_m: finite(body.accuracy_m),
            supporting_signal_only: true,
          },
        },
        { type: "eta_updated", payload: { eta_iso: etaIso, eta: etaIso, ...etaPayload } },
      ],
      orderPatch: { current_eta: etaIso },
      echo: { eta_iso: etaIso, refined: etaPayload.refined },
    };
  });
}
