"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/patients", label: "Patients" },
  { href: "/more", label: "More" },
];

export default function TabBar({ pendingApprovals = null }: { pendingApprovals?: number | null }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)] bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-[430px]">
        {TABS.map((tab) => {
          const active = pathname === tab.href
            || pathname.startsWith(`${tab.href}/`)
            || (tab.href === "/more" && pathname === "/approvals");
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex h-[60px] flex-col items-center justify-center gap-1 text-[12px] uppercase tracking-[0.05em]"
                style={{
                  fontWeight: active ? 800 : 600,
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                  borderTop: `2px solid ${active ? "var(--salmon)" : "transparent"}`,
                }}
              >
                <span className="relative">
                  {tab.label}
                  {tab.href === "/more" && pendingApprovals ? (
                    <span
                      aria-label={`${pendingApprovals} pending approvals`}
                      className="absolute -right-5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-extrabold leading-4 text-white"
                    >
                      {pendingApprovals > 99 ? "99+" : pendingApprovals}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
