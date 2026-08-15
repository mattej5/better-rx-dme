"use client";

export type ErrorStateProps = {
  message?: string;
  onRetry?: () => void; // STUB
};

export default function ErrorState({
  message = "We couldn't load this. Try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-card)] border p-5 text-center"
      style={{ background: "#FBEAE9", borderColor: "var(--red)" }}
    >
      <p className="text-[15px] text-[var(--ink)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-[44px] rounded-[var(--radius-btn)] px-4 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white"
        style={{ background: "var(--secondary)" }}
      >
        Try again
      </button>
    </div>
  );
}
