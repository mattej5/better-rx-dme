import { cookies } from "next/headers";

export type Role = "nurse" | "case_manager" | "don";

export const ROLE_COOKIE = "brx_role";
export const USER_COOKIE = "brx_user";

export const ROLE_LABELS: Record<Role, string> = {
  nurse: "Admissions nurse",
  case_manager: "Case manager",
  don: "Director of Nursing",
};

export const ROLE_FOCUS: Record<Role, string> = {
  nurse: "Admissions and discharge readiness",
  case_manager: "Your patients and anything at risk",
  don: "Approvals, at-risk count, DME cost",
};

export type Session = { role: Role; userName: string };

export function isRole(value: string | undefined): value is Role {
  return value === "nurse" || value === "case_manager" || value === "don";
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const role = jar.get(ROLE_COOKIE)?.value;
  const userName = jar.get(USER_COOKIE)?.value;
  if (!isRole(role) || !userName) return null;
  return { role, userName };
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  const options = { path: "/", sameSite: "lax" as const };
  jar.set(ROLE_COOKIE, session.role, options);
  jar.set(USER_COOKIE, session.userName, options);
}
