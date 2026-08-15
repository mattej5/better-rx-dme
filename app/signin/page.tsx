import Link from "next/link";
import { redirect } from "next/navigation";
import { avatarSrc, initials, nameSlug } from "@/src/lib/persona";
import { isRole, ROLE_FOCUS, ROLE_LABELS, setSession, type Role } from "@/src/lib/role";

const PERSONAS: { role: Role; userName: string; avatar: string }[] = [
  { role: "nurse", userName: "Maria R.", avatar: "maria-r" },
  { role: "nurse", userName: "Diego Ramirez", avatar: "diego-r" },
  { role: "case_manager", userName: "Priya N.", avatar: "priya-n" },
  { role: "case_manager", userName: "Marcus Webb", avatar: "marcus-w" },
  { role: "don", userName: "Ellen T.", avatar: "ellen-t" },
];

function Avatar({ name, slug }: { name: string; slug: string }) {
  const src = avatarSrc(slug);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={56}
      height={56}
      className="h-[56px] w-[56px] shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
      style={{ background: "var(--taupe)", color: "var(--burnt-dark)" }}
    >
      {initials(name)}
    </span>
  );
}

const dispatcherSlug = nameSlug;

const ROLE_ORDER: Role[] = ["nurse", "case_manager", "don"];

const SECTION_LABELS: Record<Role, string> = {
  nurse: "Admissions nurses",
  case_manager: "Case managers",
  don: "Director of Nursing",
};

// STUB: fixed token used when the vendors table can't be reached.
const VENDOR_DEMO_TOKEN = "demo-token";

const DISPATCHER_NAMES: Record<string, string> = {
  "Ridgeline Medical Supply": "Danny Ortiz",
  "Gulf Coast Home Medical": "Jake Fenwick",
  "ValueCare DME": "Tomas Reyes",
  "Beacon Respiratory": "Curtis Boone",
  "Cross County Mobility": "Sam Okafor",
  "NorthStar Home Equipment": "Miles Carter",
};

type VendorPersona = { token: string; vendorName: string; dispatcher: string };

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Lazy-imported the same way as app/(hospice)/patients/data.ts: src/lib/supabase.ts
 * asserts env vars at module scope, so importing it before the env check throws.
 */
async function client() {
  const mod = await import("@/src/lib/supabase");
  return mod.supabase;
}

async function loadVendorPersonas(): Promise<VendorPersona[] | null> {
  if (!hasSupabaseEnv()) return null;
  try {
    const db = await client();
    const links = await db
      .from("magic_links")
      .select("token, vendor_id")
      .eq("scope", "run_list")
      .order("token", { ascending: true })
      .limit(3);
    if (links.error) return null;
    const linkRows = links.data ?? [];
    if (linkRows.length === 0) return null;

    const vendorIds = linkRows.map((l) => l.vendor_id);
    const vendors = await db.from("vendors").select("id, name").in("id", vendorIds);
    if (vendors.error) return null;
    const nameById = new Map(vendors.data?.map((v) => [v.id, v.name]) ?? []);

    const personas = linkRows.flatMap((link) => {
      const vendorName = nameById.get(link.vendor_id);
      if (!vendorName) return [];
      return [
        {
          token: link.token,
          vendorName,
          dispatcher: DISPATCHER_NAMES[vendorName] ?? "Dispatch",
        },
      ];
    });
    return personas.length > 0 ? personas : null;
  } catch {
    return null;
  }
}

async function choosePersona(formData: FormData) {
  "use server";
  const role = formData.get("role");
  const userName = formData.get("userName");
  if (typeof role !== "string" || !isRole(role)) return;
  if (typeof userName !== "string" || userName.length === 0) return;
  await setSession({ role, userName });
  redirect("/today");
}

export default async function SignIn() {
  const vendorPersonas = await loadVendorPersonas();

  return (
    <main className="mx-auto flex min-h-screen max-w-[430px] flex-col gap-5 px-5 pb-12 pt-10">
      <header>
        <Link
          href="/"
          className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-soft"
        >
          Back
        </Link>

        <span
          className="mt-5 inline-block rounded-[3px] px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]"
          style={{ background: "var(--taupe)", color: "var(--burnt-dark)" }}
        >
          Dev only
        </span>

        <h1
          className="mt-2 text-[26px] leading-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Demo sign-in
        </h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Pick a person to impersonate. No password.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {ROLE_ORDER.map((role) => (
          <section key={role} className="flex flex-col gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {SECTION_LABELS[role]}
            </h2>
            <ul className="flex flex-col gap-2">
              {PERSONAS.filter((p) => p.role === role).map((persona) => (
                <li key={persona.userName}>
                  <form action={choosePersona}>
                    <input type="hidden" name="role" value={persona.role} />
                    <input type="hidden" name="userName" value={persona.userName} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-[10px] border border-[var(--line)] bg-surface px-4 py-3 text-left transition-colors hover:bg-paper-alt"
                      style={{ boxShadow: "var(--shadow)" }}
                    >
                      <Avatar name={persona.userName} slug={persona.avatar} />
                      <span className="min-w-0">
                        <span
                          className="block text-[16px]"
                          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                        >
                          {persona.userName}
                        </span>
                        <span className="mt-1 block text-[13px] text-ink-soft">
                          {ROLE_FOCUS[persona.role]}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">
          Vendors
        </h2>
        <ul className="flex flex-col gap-2">
          {vendorPersonas ? (
            vendorPersonas.map((vendor) => (
              <li key={vendor.token}>
                <Link
                  href={`/v/${vendor.token}`}
                  className="flex items-center gap-3 rounded-[10px] border border-dashed border-[var(--line)] bg-paper-alt px-4 py-3"
                >
                  <Avatar name={vendor.dispatcher} slug={dispatcherSlug(vendor.dispatcher)} />
                  <span className="min-w-0">
                    <span
                      className="block text-[16px]"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                    >
                      {vendor.dispatcher} · {vendor.vendorName}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          ) : (
            <li>
              <Link
                href={`/v/${VENDOR_DEMO_TOKEN}`}
                className="block rounded-[10px] border border-dashed border-[var(--line)] bg-paper-alt px-5 py-3"
              >
                <span
                  className="block text-[16px]"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Vendor demo
                </span>
              </Link>
            </li>
          )}
        </ul>
      </section>

      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-soft">
        Sample data
      </p>
    </main>
  );
}
