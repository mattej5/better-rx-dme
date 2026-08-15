/**
 * The AI-safety story, made visible. Under the confidence gate nothing changed on the
 * order: the reading is shown to a nurse with "please confirm", and `children` is
 * where the accept / correct buttons go.
 */
export type ParsedInterpretationProps = {
  /** What the parser understood, in plain words: "running late, now arriving 5:10 PM". */
  line: string;
  /** 0–1. Rendered as a percentage chip beside the parsed line. */
  confidence: number;
  children?: React.ReactNode;
};

/**
 * Mirrors ACTION_CONFIDENCE_GATE in src/lib/parse-vendor-reply.ts. Held as a local
 * constant so this stays presentational — that module owns the LLM provider path and
 * a rendered component has no business pulling it in. Whether a parse may change
 * state is decided server-side by canActOnParse(), never here.
 */
const CONFIDENCE_GATE = 0.75;

export default function ParsedInterpretation({
  line,
  confidence,
  children,
}: ParsedInterpretationProps) {
  const pct = Math.round(confidence * 100);
  const low = confidence < CONFIDENCE_GATE;
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-[var(--ink-soft)]">
          <span aria-hidden="true">→ </span>
          We read this as: {line}
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
      </div>
      {low ? (
        <p className="mt-1 text-[12.5px] text-[var(--burnt-dark)]">
          Nothing was changed on the order. Please confirm.
        </p>
      ) : null}
      {children}
    </div>
  );
}
