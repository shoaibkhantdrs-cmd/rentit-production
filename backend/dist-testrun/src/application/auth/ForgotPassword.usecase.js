"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordUseCase = void 0;
class ForgotPasswordUseCase {
    userRepo;
    auditLogRepo;
    otpIssuer;
    constructor(userRepo, auditLogRepo, otpIssuer) {
        this.userRepo = userRepo;
        this.auditLogRepo = auditLogRepo;
        this.otpIssuer = otpIssuer;
    }
    /**
     * Always resolves successfully and never reveals whether the email is
     * registered -- the controller returns the same generic message either
     * way. This is what actually prevents account enumeration; it happens
     * here (not in the controller) so it can't be bypassed by a future call
     * site.
     */
    async execute(input) {
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
exports.ForgotPasswordUseCase = ForgotPasswordUseCase;
