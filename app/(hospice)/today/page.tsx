import { redirect } from "next/navigation";
import { getSession, ROLE_FOCUS } from "@/src/lib/role";

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <section>
      <h1
        className="text-[22px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
      >
        Today
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {session.userName} · {ROLE_FOCUS[session.role]}
      </p>
    </section>
  );
}
