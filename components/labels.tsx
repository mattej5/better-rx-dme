const labelClass =
  "inline-block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]";

export function SyntheticLabel({ children }: { children?: React.ReactNode }) {
  return <span className={labelClass}>{children ?? "Synthetic data"}</span>;
}

export function AssumedLabel({ children }: { children?: React.ReactNode }) {
  return <span className={labelClass}>{children ?? "Assumed"}</span>;
}
