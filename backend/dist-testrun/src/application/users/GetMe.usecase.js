"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMeUseCase = void 0;
const User_1 = require("../../domain/entities/User");
const AppError_1 = require("../../domain/errors/AppError");
class GetMeUseCase {
    userRepo;
    userRoleRepo;
    userPreferenceRepo;
    constructor(userRepo, userRoleRepo, userPreferenceRepo) {
        this.userRepo = userRepo;
        this.userRoleRepo = userRoleRepo;
        this.userPreferenceRepo = userPreferenceRepo;
    }
    async execute(userId) {
        const user = await this.userRepo.findById(userId);
        if (!user || user.deletedAt) {
            throw new AppError_1.NotFoundError("User not found");
        }
        const roles = await this.userRoleRepo.listRoleNamesForUser(user.id);
        const preferences = await this.userPreferenceRepo.findByUserId(user.id);
        return { ...(0, User_1.toPublicUser)(user, roles), preferences };
    }
}
exports.GetMeUseCase = GetMeUseCase;
