import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { ITokenService } from "@/domain/services/ITokenService";

export interface LogoutUserInput {
  refreshToken: string;
}

export class LogoutUserUseCase {
  constructor(
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(input: LogoutUserInput): Promise<void> {
    const tokenHash = this.tokenService.hashOpaqueToken(input.refreshToken);
    const record = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    // Logout is idempotent by design: an already-invalid or unknown token
    // still results in a 204 to the caller, it just has nothing to revoke.
    if (!record || record.revokedAt) {
      return;
    }

    await this.refreshTokenRepo.revoke(record.id, "logout");
    await this.sessionRepo.revoke(record.sessionId, "logout");
    await this.auditLogRepo.record({
      userId: record.userId,
      action: "auth.logout",
      entityType: "session",
      entityId: record.sessionId,
    });
  }
}
