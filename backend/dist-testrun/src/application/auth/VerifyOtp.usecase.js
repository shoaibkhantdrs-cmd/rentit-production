"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyOtpUseCase = void 0;
const User_1 = require("../../domain/entities/User");
const AppError_1 = require("../../domain/errors/AppError");
const identifier_1 = require("../../application/auth/shared/identifier");
const ALLOWED_PURPOSES = ["login", "email_verification", "phone_verification"];
class VerifyOtpUseCase {
    userRepo;
    userRoleRepo;
    auditLogRepo;
    clock;
    sessionIssuer;
    otpVerifier;
    constructor(userRepo, userRoleRepo, auditLogRepo, clock, sessionIssuer, otpVerifier) {
        this.userRepo = userRepo;
        this.userRoleRepo = userRoleRepo;
        this.auditLogRepo = auditLogRepo;
        this.clock = clock;
        this.sessionIssuer = sessionIssuer;
        this.otpVerifier = otpVerifier;
    }
    async execute(input) {
        if (!ALLOWED_PURPOSES.includes(input.purpose)) {
            throw new AppError_1.ValidationError(`purpose must be one of: ${ALLOWED_PURPOSES.join(", ")}. Use /auth/reset-password for password_reset.`);
        }
        const identifier = (0, identifier_1.parseIdentifier)(input.identifier);
        const user = identifier.type === "email"
            ? await this.userRepo.findByEmail(identifier.value)
            : await this.userRepo.findByPhone(identifier.value);
        if (!user || user.deletedAt) {
            throw new AppError_1.UnauthorizedError("Invalid or expired code");
        }
        await this.otpVerifier.verifyAndConsume(user.id, input.purpose, input.code);
        if (input.purpose === "email_verification") {
            await this.userRepo.update(user.id, { emailVerifiedAt: this.clock.now() });
            await this.auditLogRepo.record({ userId: user.id, action: "auth.email_verified" });
            return { verified: true, authenticated: false };
        }
        if (input.purpose === "phone_verification") {
            await this.userRepo.update(user.id, { phoneVerifiedAt: this.clock.now() });
            await this.auditLogRepo.record({ userId: user.id, action: "auth.phone_verified" });
            return { verified: true, authenticated: false };
        }
        // purpose === "login"
        await this.userRepo.update(user.id, { lastLoginAt: this.clock.now() });
        const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
        const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);
        await this.auditLogRepo.record({
            userId: user.id,
            action: "auth.login.success",
            ipAddress: input.device.ipAddress,
            userAgent: input.device.userAgent,
            metadata: { method: "otp" },
        });
        return {
            verified: true,
            authenticated: true,
            user: (0, User_1.toPublicUser)(user, roleNames),
            ...tokens,
        };
    }
}
exports.VerifyOtpUseCase = VerifyOtpUseCase;
