import Link from "next/link";

const LINKS = [
  { href: "/readiness", label: "Readiness board" },
  { href: "/pickups", label: "Pickup tracker" },
  { href: "/approvals", label: "Approvals" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function MorePage() {
  return (
    <section>
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        More
      </h1>
      <ul className="mt-4 flex flex-col gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-[10px] border border-[var(--line)] bg-surface px-4 py-3 text-[15px] font-semibold"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
