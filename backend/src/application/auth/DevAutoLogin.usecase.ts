import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { toPublicUser } from "@/domain/entities/User";
import { SessionIssuer, DeviceContext } from "@/application/auth/shared/SessionIssuer";

const DEMO_USER_EMAIL = "demo@rentit.local";
const DEMO_USER_NAME = "Demo Owner (local dev)";
// Both roles: "customer" so every renter-facing page works, "property_owner"
// so List/Edit/Delete Property and image upload -- all role-gated in
// property.routes.ts via authorize("property_owner", "admin", "super_admin")
// -- work too. This is the only reason this use-case touches roles at all;
// it does not grant admin/super_admin/moderator.
const DEMO_USER_ROLES = ["customer", "property_owner"];

export interface DevAutoLoginInput {
  device: DeviceContext;
}

/**
 * Development-only convenience: mints a real, fully-privileged (for a
 * regular owner -- not admin) session for a fixed local demo account,
 * without touching OTP, SMTP, or the password/OTP login flow at all.
 *
 * Deliberately NOT a variant of RegisterUser/LoginUser -- it never calls
 * OtpIssuer or IEmailService, so by construction it cannot send an email or
 * require a verification code. It reuses the same SessionIssuer every real
 * login path uses, so the resulting access/refresh tokens are ordinary,
 * fully-valid production tokens -- this bypasses the *human step* of
 * registering/requesting-and-entering a code, not the token/session system
 * itself.
 *
 * Hard-gated on NODE_ENV: the constructor throws immediately if
 * instantiated outside development, and container.ts additionally never
 * constructs this class at all in production (see container.ts), and the
 * route that calls it is never registered outside development either (see
 * auth.routes.ts). Three independent layers, all keyed off the same
 * `nodeEnv === "development"` check the user asked for, so there's no
 * single point of failure that could leak this into a production build.
 */
export class DevAutoLoginUseCase {
  constructor(
    private readonly nodeEnv: string,
    private readonly userRepo: IUserRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly sessionIssuer: SessionIssuer,
    private readonly clock: IClock,
  ) {
    if (this.nodeEnv !== "development") {
      throw new Error(
        "DevAutoLoginUseCase must never be constructed outside NODE_ENV=development",
      );
    }
  }

  async execute(input: DevAutoLoginInput) {
    const existing = await this.userRepo.findByEmail(DEMO_USER_EMAIL);

    let user =
      existing ??
      (await this.userRepo.create({
        name: DEMO_USER_NAME,
        email: DEMO_USER_EMAIL,
        // No password on purpose -- this account is only ever reached
        // through this dev-only bypass, never through the real login form.
      }));

    if (!existing) {
      // Mark verified so the UI never shows a "please verify your
      // email/phone" nudge for what is, by definition, a fake local
      // account -- matches what a real verified owner looks like.
      user = await this.userRepo.update(user.id, {
        emailVerifiedAt: this.clock.now(),
      });
      await this.userPreferenceRepo.createDefault(user.id);
    }

    for (const roleName of DEMO_USER_ROLES) {
      const role = await this.roleRepo.findByName(roleName);
      // assign() is ON CONFLICT DO NOTHING at the DB level, so this is
      // safe to repeat on every dev server restart / every call.
      if (role) await this.userRoleRepo.assign(user.id, role.id, null);
    }

    const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);

    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.dev_login",
      entityType: "user",
      entityId: user.id,
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
    });

    return {
      user: toPublicUser(user, roleNames),
      ...tokens,
    };
  }
}
