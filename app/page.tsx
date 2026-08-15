import Link from "next/link";
import { redirect } from "next/navigation";
import { isRole, ROLE_FOCUS, ROLE_LABELS, setSession, type Role } from "@/src/lib/role";

const PERSONAS: { role: Role; userName: string }[] = [
  { role: "nurse", userName: "Maria R." },
  { role: "case_manager", userName: "Priya N." },
  { role: "don", userName: "Ellen T." },
];

// STUB: fixed token until N6 issues real magic links.
const VENDOR_DEMO_TOKEN = "demo-token";

async function choosePersona(formData: FormData) {
  "use server";
  const role = formData.get("role");
  const userName = formData.get("userName");
  if (typeof role !== "string" || !isRole(role)) return;
  if (typeof userName !== "string" || userName.length === 0) return;
  await setSession({ role, userName });
  redirect("/today");
}

export default function RoleSwitcher() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[430px] flex-col gap-5 px-5 pb-12 pt-12">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
          Desert Valley Hospice
        </p>
        <h1
          className="mt-1 text-[26px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Choose a person
        </h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Demo sign-in. No password.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {PERSONAS.map((persona) => (
          <li key={persona.role}>
            <form action={choosePersona}>
              <input type="hidden" name="role" value={persona.role} />
              <input type="hidden" name="userName" value={persona.userName} />
              <button
                type="submit"
                className="w-full rounded-[10px] border border-[var(--line)] bg-surface px-5 py-4 text-left transition-colors hover:bg-paper-alt"
                style={{ boxShadow: "var(--shadow)" }}
              >
                <span
                  className="block text-[17px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {persona.userName}
                </span>
                <span className="mt-0.5 block text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
                  {ROLE_LABELS[persona.role]}
                </span>
                <span className="mt-2 block text-[13px] text-ink-soft">
                  {ROLE_FOCUS[persona.role]}
                </span>
              </button>
            </form>
          </li>
        ))}

        <li>
          <Link
            href={`/v/${VENDOR_DEMO_TOKEN}`}
            className="block rounded-[10px] border border-dashed border-[var(--line)] bg-paper-alt px-5 py-4"
          >
            <span
              className="block text-[17px]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Vendor demo
            </span>
            <span className="mt-0.5 block text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
              Magic link, no login
            </span>
            <span className="mt-2 block text-[13px] text-ink-soft">
              The driver view a vendor opens from a text message.
            </span>
          </Link>
        </li>
      </ul>

      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-soft">
        Synthetic data
      </p>
    </main>
  );
}
