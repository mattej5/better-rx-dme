"use client";

import { usePathname, useRouter } from "next/navigation";

const TAB_ROOTS = ["/today", "/patients", "/more"];

export default function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (TAB_ROOTS.includes(pathname)) return null;

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => router.back()}
      className="flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 19l-7-7 7-7"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
