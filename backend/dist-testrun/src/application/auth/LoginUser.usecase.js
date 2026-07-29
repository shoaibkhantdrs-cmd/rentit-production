"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUserUseCase = void 0;
const User_1 = require("../../domain/entities/User");
const AppError_1 = require("../../domain/errors/AppError");
const identifier_1 = require("../../application/auth/shared/identifier");
class LoginUserUseCase {
    userRepo;
    userRoleRepo;
    auditLogRepo;
    hasher;
    clock;
    sessionIssuer;
    otpIssuer;
    constructor(userRepo, userRoleRepo, auditLogRepo, hasher, clock, sessionIssuer, otpIssuer) {
        this.userRepo = userRepo;
        this.userRoleRepo = userRoleRepo;
        this.auditLogRepo = auditLogRepo;
        this.hasher = hasher;
        this.clock = clock;
        this.sessionIssuer = sessionIssuer;
        this.otpIssuer = otpIssuer;
    }
    async execute(input) {
        const identifier = (0, identifier_1.parseIdentifier)(input.identifier);
        const user = identifier.type === "email"
            ? await this.userRepo.findByEmail(identifier.value)
            : await this.userRepo.findByPhone(identifier.value);
        // No account: behave identically to "OTP required" so the endpoint
        // can't be used to enumerate registered emails/phones.
        if (!user || user.deletedAt) {
            return { mode: "otp_required" };
        }
        this.assertLoginable(user);
        if (input.password && user.passwordHash) {
            return this.loginWithPassword(user, input.password, input.device);
        }
        await this.otpIssuer.issue(user, "login");
        await this.auditLogRepo.record({
            userId: user.id,
            action: "auth.login.otp_requested",
            ipAddress: input.device.ipAddress,
            userAgent: input.device.userAgent,
        });
        return { mode: "otp_required" };
    }
    assertLoginable(user) {
        if (user.status !== "active") {
            throw new AppError_1.ForbiddenError("This account is not active. Contact support for help.");
        }
    }
    async loginWithPassword(user, password, device) {
        const isMatch = await this.hasher.verify(password, user.passwordHash);
        if (!isMatch) {
            await this.auditLogRepo.record({
                userId: user.id,
                action: "auth.login.failed",
                ipAddress: device.ipAddress,
                userAgent: device.userAgent,
            });
            throw new AppError_1.UnauthorizedError("Invalid credentials");
        }
        await this.userRepo.update(user.id, { lastLoginAt: this.clock.now() });
        const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
        const tokens = await this.sessionIssuer.issue(user.id, roleNames, device);
        await this.auditLogRepo.record({
            userId: user.id,
            action: "auth.login.success",
            ipAddress: device.ipAddress,
            userAgent: device.userAgent,
            metadata: { method: "password" },
        });
        return {
            mode: "authenticated",
            user: (0, User_1.toPublicUser)(user, roleNames),
            ...tokens,
        };
    }
}
exports.LoginUserUseCase = LoginUserUseCase;
