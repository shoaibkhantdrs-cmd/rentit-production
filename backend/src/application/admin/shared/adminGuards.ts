import { ForbiddenError } from "@/domain/errors/AppError";

export const ADMIN_ROLES = ["admin", "super_admin"] as const;

/**
 * Safety guard shared by every admin action that targets a specific user
 * (suspend/activate/ban/delete/reset-password/role changes): a plain
 * "admin" cannot act on a "super_admin" account, only another
 * super_admin can. Prevents privilege-escalation-adjacent lockout/abuse
 * scenarios (e.g. an admin banning the only super_admin).
 */
export function assertCanModerateUser(targetRoles: string[], actorRoles: string[]): void {
  const targetIsSuperAdmin = targetRoles.includes("super_admin");
  const actorIsSuperAdmin = actorRoles.includes("super_admin");
  if (targetIsSuperAdmin && !actorIsSuperAdmin) {
    throw new ForbiddenError("Only a super_admin can moderate another super_admin's account");
  }
}
