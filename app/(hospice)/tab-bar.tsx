"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function PatientsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 15.2c2.6.2 4.7 1.8 5.5 4.3" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

const TABS = [
  { href: "/today", label: "Today", Icon: TodayIcon },
  { href: "/patients", label: "Patients", Icon: PatientsIcon },
  { href: "/more", label: "More", Icon: MoreIcon },
];

export default function TabBar({ pendingApprovals = null }: { pendingApprovals?: number | null }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--line)]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--surface)",
        boxShadow: "0 -4px 16px rgba(36, 51, 63, 0.08)",
      }}
    >
      <ul className="mx-auto flex max-w-[430px]">
        {TABS.map((tab) => {
          const active = pathname === tab.href
            || pathname.startsWith(`${tab.href}/`)
            || (tab.href === "/more" && pathname === "/approvals");
          const Icon = tab.Icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex h-[64px] flex-col items-center justify-center gap-0.5 text-[10.5px] uppercase tracking-[0.05em]"
                style={{
                  fontWeight: active ? 800 : 600,
                  color: active ? "var(--salmon-text, #8F4B22)" : "var(--ink-soft)",
                  borderTop: `2px solid ${active ? "var(--salmon)" : "transparent"}`,
                }}
              >
                <span className="relative" style={{ color: active ? "var(--ink)" : "var(--ink-soft)" }}>
                  <Icon />
                  {tab.href === "/more" && pendingApprovals ? (
                    <span
                      aria-label={`${pendingApprovals} pending approvals`}
                      className="absolute -right-3 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--red)] px-1 text-[10px] font-extrabold leading-4 text-white"
                    >
                      {pendingApprovals > 99 ? "99+" : pendingApprovals}
                    </span>
                  ) : null}
                </span>
                <span style={{ color: active ? "var(--ink)" : "var(--ink-soft)" }}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
