import { existsSync } from "node:fs";
import { join } from "node:path";

/** "Maria R." -> "maria-r", "Diego Ramirez" -> "diego-r". Matches public/personas filenames. */
export function nameSlug(name: string): string {
  const [first, second] = name.split(/\s+/);
  const initial = (second ?? "x").replace(/[^a-zA-Z]/g, "")[0] ?? "x";
  return `${(first ?? "x").toLowerCase()}-${initial.toLowerCase()}`;
}

/** Server-only check: headshot path if a file exists, else null (callers fall back to initials). */
export function avatarSrc(slug: string): string | null {
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    if (existsSync(join(process.cwd(), "public", "personas", `${slug}.${ext}`))) {
      return `/personas/${slug}.${ext}`;
    }
  }
  return null;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
