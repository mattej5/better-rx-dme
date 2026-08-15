export type SkeletonStackProps = {
  rows?: number;
  height?: number;
};

export default function SkeletonStack({
  rows = 3,
  height = 76,
}: SkeletonStackProps) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-card)]"
          style={{ height, background: "var(--paper-alt)", border: "1px solid var(--line)" }}
        />
      ))}
    </div>
  );
}
