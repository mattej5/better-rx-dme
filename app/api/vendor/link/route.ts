// POST /api/vendor/link — engine.md §1.2. Internal: notifyVendor() calls this (or
// issueMagicLink() directly) and puts the returned url in the SMS body. Issuing a
// link emits NO event; it is a magic_links row plus a line in the message_sent payload.
import type { NextRequest } from "next/server";

import { now } from "@/src/lib/clock";
import {
  hasSupabaseEnv,
  isMagicLinkScope,
  issueMagicLink,
  MAGIC_LINK_SCOPES,
  MAGIC_LINK_TTL_HOURS,
} from "@/src/lib/magic-link";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const vendorId = typeof input.vendorId === "string" ? input.vendorId : null;
  const scope = input.scope;
  const orderId = typeof input.orderId === "string" ? input.orderId : null;
  const ttlHours =
    typeof input.ttlHours === "number" && input.ttlHours > 0
      ? input.ttlHours
      : MAGIC_LINK_TTL_HOURS;

  if (!vendorId) {
    return Response.json({ error: "vendorId is required." }, { status: 400 });
  }
  if (!isMagicLinkScope(scope)) {
    return Response.json(
      { error: `scope must be one of ${MAGIC_LINK_SCOPES.join(", ")}.` },
      { status: 400 },
    );
  }
  if (scope === "stop" && !orderId) {
    return Response.json(
      { error: "orderId is required for a stop link." },
      { status: 400 },
    );
  }

  if (!hasSupabaseEnv()) {
    return Response.json(
      { error: "Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  try {
    const issued = await issueMagicLink({ vendorId, scope, orderId, ttlHours }, await now());
    return Response.json({
      token: issued.token,
      path: issued.path,
      url: new URL(issued.path, request.nextUrl.origin).toString(),
      scope,
      expiresAt: issued.expiresAt,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not issue a link." },
      { status: 500 },
    );
  }
}
