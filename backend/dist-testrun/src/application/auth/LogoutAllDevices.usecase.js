"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogoutAllDevicesUseCase = void 0;
class LogoutAllDevicesUseCase {
    refreshTokenRepo;
    sessionRepo;
    auditLogRepo;
    constructor(refreshTokenRepo, sessionRepo, auditLogRepo) {
        this.refreshTokenRepo = refreshTokenRepo;
        this.sessionRepo = sessionRepo;
        this.auditLogRepo = auditLogRepo;
    }
    async execute(input) {
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
exports.LogoutAllDevicesUseCase = LogoutAllDevicesUseCase;
