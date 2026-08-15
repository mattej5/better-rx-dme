import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, ROLE_LABELS } from "@/src/lib/role";
import TabBar from "./tab-bar";

export default async function HospiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-surface">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3 px-5 py-3">
          <span
            className="text-[16px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            BetterRX DME
          </span>
          <Link
            href="/"
            className="rounded-[10px] bg-paper-alt px-3 py-1.5 text-right"
          >
            <span className="block text-[13px] font-semibold leading-tight">
              {session.userName}
            </span>
            <span className="block text-[10.5px] font-bold uppercase tracking-[0.05em] leading-tight text-ink-soft">
              {ROLE_LABELS[session.role]}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] px-5 pb-[84px] pt-5">{children}</main>

      <TabBar />
    </div>
  );
}
