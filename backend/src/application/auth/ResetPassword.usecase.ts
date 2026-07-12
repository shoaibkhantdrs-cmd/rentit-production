import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IHasher } from "@/domain/services/IHasher";
import { UnauthorizedError } from "@/domain/errors/AppError";
import { OtpVerifier } from "@/application/auth/shared/OtpVerifier";

export interface ResetPasswordInput {
  email: string;
  code: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly hasher: IHasher,
    private readonly otpVerifier: OtpVerifier,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(email);

    if (!user || user.deletedAt) {
      // Same code path/timing as "wrong code" -- never confirm the email
      // doesn't exist.
      throw new UnauthorizedError("Invalid or expired code");
    }

    await this.otpVerifier.verifyAndConsume(user.id, "password_reset", input.code);

    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.userRepo.update(user.id, { passwordHash });

    // Resetting the password invalidates every existing session -- if an
    // attacker's session was active, this ends it too.
    await this.refreshTokenRepo.revokeAllForUser(user.id, "password_reset");
    await this.sessionRepo.revokeAllForUser(user.id, "password_reset");

    await this.auditLogRepo.record({ userId: user.id, action: "auth.password.reset" });

    await this.notificationRepo.create({
      userId: user.id,
      type: "security.password_changed",
      title: "Your password was changed",
      body: "If this wasn't you, contact support immediately.",
    });
  }
}
