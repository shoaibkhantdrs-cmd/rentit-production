import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IHasher } from "@/domain/services/IHasher";
import { IClock } from "@/domain/services/IClock";
import { toPublicUser, User } from "@/domain/entities/User";
import { ForbiddenError, UnauthorizedError } from "@/domain/errors/AppError";
import { SessionIssuer, DeviceContext } from "@/application/auth/shared/SessionIssuer";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { parseIdentifier } from "@/application/auth/shared/identifier";

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
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    const identifier = parseIdentifier(input.identifier);
    const user =
      identifier.type === "email"
        ? await this.userRepo.findByEmail(identifier.value)
        : await this.userRepo.findByPhone(identifier.value);

    // No account: behave identically to "OTP required" so the endpoint
    // can't be used to enumerate registered emails/phones.
    if (!user || user.deletedAt) {
      return { mode: "otp_required" };
    }

    this.assertLoginable(user);

    if (input.password && user.passwordHash) {
      return this.loginWithPassword(user, input.password, input.device);
    }

    await this.otpIssuer.issue(user, "login");
    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.login.otp_requested",
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
    });

    return { mode: "otp_required" };
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
