import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";

export interface LogoutAllDevicesInput {
  userId: string;
}

export class LogoutAllDevicesUseCase {
  constructor(
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: LogoutAllDevicesInput): Promise<{ revokedSessions: number }> {
    await this.refreshTokenRepo.revokeAllForUser(input.userId, "logout_all");
    const revokedSessions = await this.sessionRepo.revokeAllForUser(input.userId, "logout_all");

    await this.auditLogRepo.record({
      userId: input.userId,
      action: "auth.logout_all",
      metadata: { revokedSessions },
    });

    return { revokedSessions };
  }
}
