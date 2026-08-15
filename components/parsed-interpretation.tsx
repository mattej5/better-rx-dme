export type ParsedInterpretationProps = {
  /** What the parser understood, in plain words: "delayed ~2h, reason: traffic". */
  line: string;
  /** 0–1. Rendered as a percentage chip beside the parsed line. */
  confidence: number;
};

export default function ParsedInterpretation({
  line,
  confidence,
}: ParsedInterpretationProps) {
  const pct = Math.round(confidence * 100);
  const low = confidence < 0.7;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <p className="text-[13px] text-[var(--ink-soft)]">
        <span aria-hidden="true">→ </span>
        {line}
      </p>
      <span
        className="rounded-[var(--radius-badge)] px-2 py-[2px] text-[10.8px] font-bold uppercase tracking-[0.05em]"
        style={{
          background: low ? "var(--burnt-tint)" : "var(--green-tint)",
          color: low ? "var(--burnt-dark)" : "#4A7D33",
        }}
      >
        {pct}% confidence
      </span>
      {low ? (
        <span className="text-[12px] text-[var(--burnt-dark)]">
          Confirm before acting
        </span>
      ) : null}
    </div>
  );
}
