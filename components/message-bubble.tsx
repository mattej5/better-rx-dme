export type MessageBubbleProps = {
  direction: "outbound" | "inbound";
  body: string;
  who: string;
  at?: string;
};

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
      <p className="mt-1 text-[14px]">{body}</p>
    </div>
  );
}
