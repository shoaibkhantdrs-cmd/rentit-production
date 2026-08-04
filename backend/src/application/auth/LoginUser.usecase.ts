import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IHasher } from "@/domain/services/IHasher";
import { IClock } from "@/domain/services/IClock";
import { toPublicUser, User } from "@/domain/entities/User";
import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from "@/domain/errors/AppError";
import { SessionIssuer, DeviceContext } from "@/application/auth/shared/SessionIssuer";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { parseIdentifier } from "@/application/auth/shared/identifier";
import { logger } from "@/infrastructure/logging/logger";

const DEFAULT_ROLE = "customer";

/** Turns "jane.doe+rentit@example.com" into "Jane.doe" -- a readable
 * placeholder the user can change on their Profile page later. Login-via-
 * OTP has no name field (unlike /auth/register), so auto-provisioning has
 * to invent something rather than leaving name null, which the User
 * entity/DB schema don't allow. */
function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  const cleaned = localPart.replace(/[._+-]+/g, " ").trim() || "there";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export interface LoginUserInput {
  identifier: string;
  password?: string;
  device: DeviceContext;
}

export type LoginUserResult =
  | { mode: "authenticated"; user: ReturnType<typeof toPublicUser>; accessToken: string; refreshToken: string; sessionId: string }
  | { mode: "otp_required" };

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly hasher: IHasher,
    private readonly clock: IClock,
    private readonly sessionIssuer: SessionIssuer,
    private readonly otpIssuer: OtpIssuer,
    private readonly roleRepo: IRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const identifier = parseIdentifier(input.identifier);
    let user =
      identifier.type === "email"
        ? await this.userRepo.findByEmail(identifier.value)
        : await this.userRepo.findByPhone(identifier.value);

    if ((!user || user.deletedAt) && identifier.type === "email") {
      // Passwordless login doubles as sign-up: entering a brand-new email
      // on the sign-in screen auto-creates the account (matching
      // RegisterUserUseCase's default role/preferences) instead of
      // silently no-op'ing. The generic "otp_required" response below is
      // unchanged either way, so this still can't be used to enumerate
      // which emails are already registered -- the only observable
      // difference is that a code now actually arrives.
      user = await this.autoRegister(identifier.value, input.device);
    }

    // No account (or a deleted one) and not an email identifier: behave
    // identically to "OTP required" so the endpoint can't be used to
    // enumerate registered phone numbers. Phone-based passwordless
    // sign-up isn't in scope here -- phone numbers are only ever added via
    // the already-verified Profile flow (see UpdateMe.usecase.ts).
    if (!user || user.deletedAt) {
      return { mode: "otp_required" };
    }

    this.assertLoginable(user);

    if (input.password && user.passwordHash) {
      return this.loginWithPassword(user, input.password, input.device);
    }

try {
        await this.otpIssuer.issue(user, "login");
} catch (err) {
        logger.error({ err, userId: user.id }, "Failed to issue login OTP");
        throw new ServiceUnavailableError(
                  "We couldn't send your login code right now. Please try again in a moment.",
                );
}
    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.login.otp_requested",
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
    });

    return { mode: "otp_required" };
  }

  /** Mirrors the account-creation half of RegisterUserUseCase.execute()
   * (user row, default "customer" role, default preferences, audit log) --
   * deliberately skips RegisterUserUseCase's password hashing, welcome
   * email, and immediate token issuance, since this path always continues
   * into the normal OTP-issue/verify flow below/at VerifyOtpUseCase,
   * exactly like an existing user logging in via OTP. */
  private async autoRegister(email: string, device: DeviceContext): Promise<User> {
    const user = await this.userRepo.create({ name: nameFromEmail(email), email });

    const role = await this.roleRepo.findByName(DEFAULT_ROLE);
    if (role) {
      await this.userRoleRepo.assign(user.id, role.id, null);
    }

    await this.userPreferenceRepo.createDefault(user.id);

    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.register.auto_via_login",
      entityType: "user",
      entityId: user.id,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    return user;
  }

  private assertLoginable(user: User): void {
    if (user.status !== "active") {
      throw new ForbiddenError("This account is not active. Contact support for help.");
    }
  }

  private async loginWithPassword(
    user: User,
    password: string,
    device: DeviceContext,
  ): Promise<LoginUserResult> {
    const isMatch = await this.hasher.verify(password, user.passwordHash as string);

    if (!isMatch) {
      await this.auditLogRepo.record({
        userId: user.id,
        action: "auth.login.failed",
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      });
      throw new UnauthorizedError("Invalid credentials");
    }

    await this.userRepo.update(user.id, { lastLoginAt: this.clock.now() });

    const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const tokens = await this.sessionIssuer.issue(user.id, roleNames, device);

    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.login.success",
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      metadata: { method: "password" },
    });

    return {
      mode: "authenticated",
      user: toPublicUser(user, roleNames),
      ...tokens,
    };
  }
}
