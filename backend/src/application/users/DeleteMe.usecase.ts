import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError } from "@/domain/errors/AppError";

export class DeleteMeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    await this.userRepo.softDelete(userId);
    await this.refreshTokenRepo.revokeAllForUser(userId, "account_deleted");
    await this.sessionRepo.revokeAllForUser(userId, "account_deleted");

    await this.auditLogRepo.record({ userId, action: "user.self_deleted" });
  }
}
