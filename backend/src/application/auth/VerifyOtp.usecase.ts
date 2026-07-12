import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { toPublicUser } from "@/domain/entities/User";
import { OtpPurpose } from "@/domain/entities/OtpCode";
import { UnauthorizedError, ValidationError } from "@/domain/errors/AppError";
import { SessionIssuer, DeviceContext } from "@/application/auth/shared/SessionIssuer";
import { OtpVerifier } from "@/application/auth/shared/OtpVerifier";
import { parseIdentifier } from "@/application/auth/shared/identifier";

export interface VerifyOtpInput {
  identifier: string;
  purpose: OtpPurpose;
  code: string;
  device: DeviceContext;
}

const ALLOWED_PURPOSES: OtpPurpose[] = ["login", "email_verification", "phone_verification"];

export type VerifyOtpResult =
  | { verified: true; authenticated: true; user: ReturnType<typeof toPublicUser>; accessToken: string; refreshToken: string; sessionId: string }
  | { verified: true; authenticated: false };

export class VerifyOtpUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
    private readonly sessionIssuer: SessionIssuer,
    private readonly otpVerifier: OtpVerifier,
  ) {}

  async execute(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    if (!ALLOWED_PURPOSES.includes(input.purpose)) {
      throw new ValidationError(
        `purpose must be one of: ${ALLOWED_PURPOSES.join(", ")}. Use /auth/reset-password for password_reset.`,
      );
    }

    const identifier = parseIdentifier(input.identifier);
    const user =
      identifier.type === "email"
        ? await this.userRepo.findByEmail(identifier.value)
        : await this.userRepo.findByPhone(identifier.value);

    if (!user || user.deletedAt) {
      throw new UnauthorizedError("Invalid or expired code");
    }

    await this.otpVerifier.verifyAndConsume(user.id, input.purpose, input.code);

    if (input.purpose === "email_verification") {
      await this.userRepo.update(user.id, { emailVerifiedAt: this.clock.now() });
      await this.auditLogRepo.record({ userId: user.id, action: "auth.email_verified" });
      return { verified: true, authenticated: false };
    }

    if (input.purpose === "phone_verification") {
      await this.userRepo.update(user.id, { phoneVerifiedAt: this.clock.now() });
      await this.auditLogRepo.record({ userId: user.id, action: "auth.phone_verified" });
      return { verified: true, authenticated: false };
    }

    // purpose === "login"
    await this.userRepo.update(user.id, { lastLoginAt: this.clock.now() });
    const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);

    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.login.success",
      ipAddress: input.device.ipAddress,
      userAgent: input.device.userAgent,
      metadata: { method: "otp" },
    });

    return {
      verified: true,
      authenticated: true,
      user: toPublicUser(user, roleNames),
      ...tokens,
    };
  }
}
