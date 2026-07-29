"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMeUseCase = void 0;
const User_1 = require("../../domain/entities/User");
const AppError_1 = require("../../domain/errors/AppError");
class UpdateMeUseCase {
    userRepo;
    userRoleRepo;
    userPreferenceRepo;
    activityLogRepo;
    otpIssuer;
    constructor(userRepo, userRoleRepo, userPreferenceRepo, activityLogRepo, otpIssuer) {
        this.userRepo = userRepo;
        this.userRoleRepo = userRoleRepo;
        this.userPreferenceRepo = userPreferenceRepo;
        this.activityLogRepo = activityLogRepo;
        this.otpIssuer = otpIssuer;
    }
    async execute(input) {
        const user = await this.userRepo.findById(input.userId);
        if (!user || user.deletedAt) {
            throw new AppError_1.NotFoundError("User not found");
        }
        const patch = {};
        if (input.name !== undefined) {
            patch.name = input.name.trim();
        }
        let phoneChanged = false;
        if (input.phone !== undefined && input.phone !== user.phone) {
            if (input.phone) {
                const existing = await this.userRepo.findByPhone(input.phone);
                if (existing && existing.id !== user.id) {
                    throw new AppError_1.ConflictError("This phone number is already in use");
                }
            }
            patch.phone = input.phone;
            // Changing the phone invalidates the previous verification.
            patch.phoneVerifiedAt = input.phone ? null : null;
            phoneChanged = true;
        }
        const updated = Object.keys(patch).length > 0 ? await this.userRepo.update(user.id, patch) : user;
        if (input.preferences) {
            await this.userPreferenceRepo.update(user.id, input.preferences);
        }
        await this.activityLogRepo.record({ userId: user.id, action: "profile.updated" });
        if (phoneChanged && updated.phone) {
            await this.otpIssuer.issue(updated, "phone_verification");
        }
        const roles = await this.userRoleRepo.listRoleNamesForUser(user.id);
        const preferences = await this.userPreferenceRepo.findByUserId(user.id);
        return { ...(0, User_1.toPublicUser)(updated, roles), preferences };
    }
}
exports.UpdateMeUseCase = UpdateMeUseCase;
