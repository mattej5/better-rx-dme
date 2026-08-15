import Link from "next/link";
import { getPendingApprovalCount } from "@/app/actions/approvals";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/readiness", label: "Readiness board" },
  { href: "/pickups", label: "Pickups" },
  { href: "/approvals", label: "Approvals" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default async function MorePage() {
  const pendingApprovals = await getPendingApprovalCount();

  return (
    <section>
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        More
      </h1>
      <ul className="mt-4 flex flex-col gap-2">
        {LINKS.map((link) => {
          const badge = link.href === "/approvals" ? pendingApprovals : null;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between rounded-[10px] border border-[var(--line)] bg-surface px-4 py-3 text-[15px] font-semibold"
              >
                {link.label}
                {badge ? (
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--ink-soft)]">
                    {badge === 1 ? "1 waiting" : `${badge} waiting`}
                    <span
                      aria-hidden
                      className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white"
                      style={{ background: "var(--red)" }}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
