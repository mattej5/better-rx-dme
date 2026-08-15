import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingApprovalCount } from "@/app/actions/approvals";
import { getSession, ROLE_LABELS } from "@/src/lib/role";
import BackButton from "./back-button";
import TabBar from "./tab-bar";

export default async function HospiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, pendingApprovals] = await Promise.all([
    getSession(),
    getPendingApprovalCount(),
  ]);
  if (!session) redirect("/");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-surface">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-1">
            <BackButton />
            <span
              className="text-[16px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
            >
              BetterRX DME
            </span>
          </div>
          <Link
            href="/signin"
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

      <TabBar pendingApprovals={pendingApprovals} />
    </div>
  );
}
