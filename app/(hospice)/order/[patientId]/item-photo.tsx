import type { CategoryKey } from "./types";

/**
 * equipment_catalog.image_url is null in the seed, so there is no real product photo
 * to show. Rather than invent one, each category gets a line drawing at photo size.
 * If image_url is ever populated the photo takes over with no other change.
 */
const GLYPH: Record<CategoryKey, React.ReactNode> = {
  bed: (
    <g>
      <path d="M6 30h36M6 30V18M42 30v-6M6 24h36" />
      <path d="M12 24v-4h10v4" />
      <circle cx="30" cy="20" r="3" />
    </g>
  ),
  respiratory: (
    <g>
      <rect x="14" y="12" width="20" height="26" rx="4" />
      <path d="M20 12V9a4 4 0 0 1 8 0v3M20 22h8M20 28h8" />
    </g>
  ),
  mobility: (
    <g>
      <circle cx="17" cy="33" r="7" />
      <circle cx="34" cy="35" r="4" />
      <path d="M10 14h6l4 14h13M24 20h9" />
    </g>
  ),
  transfer: (
    <g>
      <path d="M12 38V16h16v22M12 22h16" />
      <path d="M32 38V12h6" />
      <circle cx="20" cy="10" r="4" />
    </g>
  ),
  consumable: (
    <g>
      <rect x="10" y="14" width="28" height="22" rx="3" />
      <path d="M10 22h28M20 14v-4h8v4" />
    </g>
  ),
};

export default function ItemPhoto({
  category,
  imageUrl,
  plainName,
  size = 52,
}: {
  category: CategoryKey;
  imageUrl?: string | null;
  plainName: string;
  size?: number;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={plainName}
        width={size}
        height={size}
        className="shrink-0 rounded-[8px] object-cover"
        style={{ width: size, height: size, border: "1px solid var(--line)" }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        background: "var(--paper-alt)",
        border: "1px solid var(--line)",
      }}
    >
      <svg
        viewBox="0 0 48 48"
        width={size - 16}
        height={size - 16}
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPH[category]}
      </svg>
    </span>
  );
}
