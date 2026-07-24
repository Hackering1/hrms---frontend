// Maps the signed-in user's role to an accent color so each portal
// (admin / manager / employee) feels distinct while staying one design system.
export type RoleKey = "admin" | "manager" | "employee";

export interface RoleAccent {
  key: RoleKey;
  color: string; // accent hex
  soft: string; // soft tint for backgrounds/pills
}

export function roleAccent(roles: string[] = []): RoleAccent {
  const has = (r: string) => roles.some((x) => x.replace("ROLE_", "") === r);

  if (has("SUPER_ADMIN") || has("HR_ADMIN") || has("HR_EXECUTIVE")) {
    return { key: "admin", color: "#4F46E5", soft: "#EEF2FF" };
  }
  if (has("MANAGER")) {
    return { key: "manager", color: "#7C3AED", soft: "#F5F3FF" };
  }
  return { key: "employee", color: "#0D9488", soft: "#F0FDFA" };
}
