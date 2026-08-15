export type MessageBubbleProps = {
  direction: "outbound" | "inbound";
  body: string;
  who: string;
  at?: string;
};

const URL_RE = /https?:\/\/[^\s]+/g;

/** Raw URLs (magic links are ~90 unbroken chars) become a short tappable link. */
function Body({ body }: { body: string }) {
  const parts = body.split(URL_RE);
  const urls = body.match(URL_RE) ?? [];
  return (
    <p className="mt-1 break-words text-[14px]">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {urls[i] ? (
            <a
              href={urls[i]}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2"
              style={{ color: "#35618A" }}
            >
              Open link
            </a>
          ) : null}
        </span>
      ))}
    </p>
  );
}

export default function MessageBubble({
  direction,
  body,
  who,
  at,
}: MessageBubbleProps) {
  const inbound = direction === "inbound";
  return (
    <div
      className="mt-2 max-w-[300px] rounded-[10px] px-3 py-2"
      style={{
        background: inbound ? "var(--paper-alt)" : "var(--royal-tint)",
        border: "1px solid var(--line)",
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
        {who}
        {at ? ` · ${at}` : ""}
      </p>
      <Body body={body} />
    </div>
  );
}
