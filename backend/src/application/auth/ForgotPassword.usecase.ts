import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";

export interface ForgotPasswordInput {
  email: string;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly otpIssuer: OtpIssuer,
  ) {}

  /**
   * Always resolves successfully and never reveals whether the email is
   * registered -- the controller returns the same generic message either
   * way. This is what actually prevents account enumeration; it happens
   * here (not in the controller) so it can't be bypassed by a future call
   * site.
   */
  async execute(input: ForgotPasswordInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(email);

    if (!user || user.deletedAt) {
      return;
    }

    await this.otpIssuer.issue(user, "password_reset");
    await this.auditLogRepo.record({
      userId: user.id,
      action: "auth.password.forgot_requested",
    });
  }
}
