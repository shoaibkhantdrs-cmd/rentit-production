"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogoutUserUseCase = void 0;
class LogoutUserUseCase {
    refreshTokenRepo;
    sessionRepo;
    auditLogRepo;
    tokenService;
    constructor(refreshTokenRepo, sessionRepo, auditLogRepo, tokenService) {
        this.refreshTokenRepo = refreshTokenRepo;
        this.sessionRepo = sessionRepo;
        this.auditLogRepo = auditLogRepo;
        this.tokenService = tokenService;
    }
    async execute(input) {
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
exports.LogoutUserUseCase = LogoutUserUseCase;
