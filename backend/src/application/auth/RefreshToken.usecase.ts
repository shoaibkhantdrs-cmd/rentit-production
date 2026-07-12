import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { ITokenService } from "@/domain/services/ITokenService";
import { IClock } from "@/domain/services/IClock";
import { AuthConfig } from "@/application/dtos/AuthConfig";
import { UnauthorizedError } from "@/domain/errors/AppError";

export interface RefreshTokenInput {
  refreshToken: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly tokenService: ITokenService,
    private readonly clock: IClock,
    private readonly config: AuthConfig,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenResult> {
    const tokenHash = this.tokenService.hashOpaqueToken(input.refreshToken);
    const record = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!record) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (record.revokedAt) {
      // A token that was already rotated away (or explicitly revoked) is
      // being replayed. Treat the whole rotation family as compromised:
      // revoke every token in it and kill the session, forcing a fresh
      // login. This is the standard "refresh token reuse detection"
      // mitigation against stolen-token replay.
      await this.refreshTokenRepo.revokeFamily(record.familyId, "reuse_detected");
      await this.sessionRepo.revoke(record.sessionId, "refresh_token_reuse_detected");
      await this.auditLogRepo.record({
        userId: record.userId,
        action: "auth.refresh.reuse_detected",
        entityType: "session",
        entityId: record.sessionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      throw new UnauthorizedError("Session has been revoked. Please log in again.");
    }

    if (record.expiresAt.getTime() < this.clock.now().getTime()) {
      throw new UnauthorizedError("Refresh token expired. Please log in again.");
    }

    const rawNewToken = this.tokenService.generateOpaqueToken();
    const newTokenHash = this.tokenService.hashOpaqueToken(rawNewToken);
    const newExpiresAt = new Date(
      this.clock.now().getTime() + this.config.refreshTokenTtlSeconds * 1000,
    );

    const newRecord = await this.refreshTokenRepo.create({
      userId: record.userId,
      sessionId: record.sessionId,
      tokenHash: newTokenHash,
      familyId: record.familyId,
      expiresAt: newExpiresAt,
    });

    await this.refreshTokenRepo.markReplaced(record.id, newRecord.id);
    await this.refreshTokenRepo.revoke(record.id, "rotated");
    await this.sessionRepo.touchLastActive(record.sessionId);

    const roleNames = await this.userRoleRepo.listRoleNamesForUser(record.userId);
    const accessToken = this.tokenService.signAccessToken({
      sub: record.userId,
      roles: roleNames,
      sessionId: record.sessionId,
    });

    await this.auditLogRepo.record({
      userId: record.userId,
      action: "auth.refresh.success",
      entityType: "session",
      entityId: record.sessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return { accessToken, refreshToken: rawNewToken };
  }
}
