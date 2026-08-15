import type { ResolveResult } from "@/src/lib/magic-link";

type Closed = Exclude<ResolveResult["status"], "ok">;

const COPY: Record<Closed, { title: string; body: string }> = {
  expired: {
    title: "This link has expired",
    body: "Ask the hospice to send a new one. Nothing is lost — links time out after 72 hours.",
  },
  unknown: {
    title: "We couldn't find this link",
    body: "It may have been retyped or cut off in a text. Ask the hospice to send it again.",
  },
  error: {
    title: "We couldn't load this page",
    body: "The link is fine. Wait a moment and open it again.",
  },
};

/**
 * The person holding an expired token is a driver standing at a house, not an
 * engineer. Calm page, no stack trace, no red.
 */
export default function LinkClosed({ status }: { status: Closed }) {
  const copy = COPY[status];
  return (
    <section className="pt-10">
      <h1
        className="text-[24px] leading-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        {copy.title}
      </h1>
      <p className="mt-2 text-[15px] text-[var(--ink-soft)]">{copy.body}</p>
      <p className="mt-6 text-[13.5px] text-[var(--ink-soft)]">
        If a delivery or pickup is waiting, call the hospice that texted you. They can
        send a fresh link in a few seconds.
      </p>
    </section>
  );
}
