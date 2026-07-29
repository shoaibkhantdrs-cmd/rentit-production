"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordUseCase = void 0;
const AppError_1 = require("../../domain/errors/AppError");
class ResetPasswordUseCase {
    userRepo;
    refreshTokenRepo;
    sessionRepo;
    auditLogRepo;
    notificationRepo;
    hasher;
    otpVerifier;
    constructor(userRepo, refreshTokenRepo, sessionRepo, auditLogRepo, notificationRepo, hasher, otpVerifier) {
        this.userRepo = userRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.sessionRepo = sessionRepo;
        this.auditLogRepo = auditLogRepo;
        this.notificationRepo = notificationRepo;
        this.hasher = hasher;
        this.otpVerifier = otpVerifier;
    }
    async execute(input) {
        const email = input.email.trim().toLowerCase();
        const user = await this.userRepo.findByEmail(email);
        if (!user || user.deletedAt) {
            // Same code path/timing as "wrong code" -- never confirm the email
            // doesn't exist.
            throw new AppError_1.UnauthorizedError("Invalid or expired code");
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
exports.ResetPasswordUseCase = ResetPasswordUseCase;
