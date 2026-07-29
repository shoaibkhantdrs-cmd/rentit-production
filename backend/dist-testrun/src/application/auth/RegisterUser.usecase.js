"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterUserUseCase = void 0;
const User_1 = require("../../domain/entities/User");
const AppError_1 = require("../../domain/errors/AppError");
const EmailTemplates_1 = require("../../application/notifications/EmailTemplates");
const DEFAULT_ROLE = "customer";
class RegisterUserUseCase {
    userRepo;
    roleRepo;
    userRoleRepo;
    userPreferenceRepo;
    auditLogRepo;
    hasher;
    sessionIssuer;
    otpIssuer;
    emailService;
    constructor(userRepo, roleRepo, userRoleRepo, userPreferenceRepo, auditLogRepo, hasher, sessionIssuer, otpIssuer, emailService) {
        this.userRepo = userRepo;
        this.roleRepo = roleRepo;
        this.userRoleRepo = userRoleRepo;
        this.userPreferenceRepo = userPreferenceRepo;
        this.auditLogRepo = auditLogRepo;
        this.hasher = hasher;
        this.sessionIssuer = sessionIssuer;
        this.otpIssuer = otpIssuer;
        this.emailService = emailService;
    }
    async execute(input) {
        const email = input.email.trim().toLowerCase();
        const existingByEmail = await this.userRepo.findByEmail(email);
        if (existingByEmail) {
            throw new AppError_1.ConflictError("An account with this email already exists");
        }
        if (input.phone) {
            const existingByPhone = await this.userRepo.findByPhone(input.phone);
            if (existingByPhone) {
                throw new AppError_1.ConflictError("An account with this phone number already exists");
            }
        }
        const passwordHash = input.password ? await this.hasher.hash(input.password) : null;
        const user = await this.userRepo.create({
            name: input.name.trim(),
            email,
            phone: input.phone,
            passwordHash,
        });
        const role = await this.roleRepo.findByName(DEFAULT_ROLE);
        if (role) {
            await this.userRoleRepo.assign(user.id, role.id, null);
        }
        await this.userPreferenceRepo.createDefault(user.id);
        await this.auditLogRepo.record({
            userId: user.id,
            action: "auth.register",
            entityType: "user",
            entityId: user.id,
            ipAddress: input.device.ipAddress,
            userAgent: input.device.userAgent,
        });
        // Fire-and-forget-but-awaited verification codes. Failure to send should
        // not fail registration itself once the account row exists.
        await this.otpIssuer.issue(user, "email_verification");
        if (input.phone) {
            await this.otpIssuer.issue(user, "phone_verification");
        }
        await this.emailService.send((0, EmailTemplates_1.buildWelcomeEmail)(user.email, user.name));
        const roleNames = await this.userRoleRepo.listRoleNamesForUser(user.id);
        const tokens = await this.sessionIssuer.issue(user.id, roleNames, input.device);
        return {
            user: (0, User_1.toPublicUser)(user, roleNames),
            ...tokens,
        };
    }
}
exports.RegisterUserUseCase = RegisterUserUseCase;
