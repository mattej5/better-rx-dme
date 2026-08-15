"use client";

export type BigActionButtonProps = {
  size?: "lg" | "xl";
  tone?: "primary" | "slate" | "quiet";
  children: React.ReactNode;
  onClick?: () => void; // STUB — N7/N9 wire the server action here
  type?: "button" | "submit";
  disabled?: boolean;
  fullWidth?: boolean;
};

const TONE: Record<
  NonNullable<BigActionButtonProps["tone"]>,
  { background: string; color: string; border: string }
> = {
  primary: { background: "var(--salmon)", color: "#24333F", border: "0" },
  slate: { background: "var(--secondary)", color: "#FFFFFF", border: "0" },
  quiet: {
    background: "var(--surface)",
    color: "var(--ink)",
    border: "1px solid var(--line)",
  },
};

export default function BigActionButton({
  size = "lg",
  tone = "primary",
  children,
  onClick,
  type = "button",
  disabled = false,
  fullWidth = true,
}: BigActionButtonProps) {
  const t = TONE[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-[var(--radius-btn)] font-extrabold uppercase tracking-[0.04em] disabled:opacity-50"
      style={{
        background: t.background,
        color: t.color,
        border: t.border,
        width: fullWidth ? "100%" : undefined,
        minHeight: size === "xl" ? 64 : 48,
        fontSize: size === "xl" ? 18 : 14,
        padding: size === "xl" ? "18px 24px" : "12px 20px",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </button>
  );
}
