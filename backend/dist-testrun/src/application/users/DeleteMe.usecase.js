"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteMeUseCase = void 0;
const AppError_1 = require("../../domain/errors/AppError");
class DeleteMeUseCase {
    userRepo;
    refreshTokenRepo;
    sessionRepo;
    auditLogRepo;
    constructor(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo) {
        this.userRepo = userRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.sessionRepo = sessionRepo;
        this.auditLogRepo = auditLogRepo;
    }
    async execute(userId) {
        const user = await this.userRepo.findById(userId);
        if (!user || user.deletedAt) {
            throw new AppError_1.NotFoundError("User not found");
        }
        await this.userRepo.softDelete(userId);
        await this.refreshTokenRepo.revokeAllForUser(userId, "account_deleted");
        await this.sessionRepo.revokeAllForUser(userId, "account_deleted");
        await this.auditLogRepo.record({ userId, action: "user.self_deleted" });
    }
}
exports.DeleteMeUseCase = DeleteMeUseCase;
