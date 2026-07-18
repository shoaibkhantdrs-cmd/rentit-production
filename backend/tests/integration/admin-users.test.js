"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildAdminTestContainer_1 = require("../support/buildAdminTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
async function makeUser(container, name, email, roleNames = []) {
    const user = await container.repos.userRepo.create({ name, email });
    for (const roleName of roleNames) {
        const role = await container.repos.roleRepo.findByName(roleName);
        if (!role)
            throw new Error(`Unknown seeded role: ${roleName}`);
        await container.repos.userRoleRepo.assign(user.id, role.id, null);
    }
    return user;
}
(0, node_test_1.test)("SearchUsersUseCase: filters by query, status, and role", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const alice = await makeUser(container, "Alice Owner", "alice@example.com", ["property_owner"]);
    await makeUser(container, "Bob Customer", "bob@example.com", ["customer"]);
    await container.repos.userRepo.update(alice.id, { status: "suspended" });
    const byQuery = await container.searchUsers.execute({ query: "alice", page: 1, pageSize: 20 });
    strict_1.default.equal(byQuery.total, 1);
    strict_1.default.equal(byQuery.items[0].email, "alice@example.com");
    const byStatus = await container.searchUsers.execute({ status: "suspended", page: 1, pageSize: 20 });
    strict_1.default.equal(byStatus.total, 1);
    strict_1.default.equal(byStatus.items[0].id, alice.id);
    const byRole = await container.searchUsers.execute({ role: "customer", page: 1, pageSize: 20 });
    strict_1.default.equal(byRole.total, 1);
    strict_1.default.equal(byRole.items[0].email, "bob@example.com");
});
(0, node_test_1.test)("GetUserProfileUseCase: 404s for unknown user, returns roles/preferences/activity/propertyCount", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const user = await makeUser(container, "Carol", "carol@example.com", ["property_owner"]);
    await container.repos.activityLogRepo.record({ userId: user.id, action: "login" });
    const profile = await container.getUserProfile.execute(user.id);
    strict_1.default.equal(profile.email, "carol@example.com");
    strict_1.default.deepEqual(profile.roles, ["property_owner"]);
    strict_1.default.equal(profile.recentActivity.length, 1);
    strict_1.default.equal(profile.propertyCount, 0);
    await strict_1.default.rejects(() => container.getUserProfile.execute("00000000-0000-0000-0000-000000000000"), AppError_1.NotFoundError);
});
(0, node_test_1.test)("UpdateUserStatusUseCase: suspends a user, revokes sessions, and is audit-logged", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    const target = await makeUser(container, "Target", "target@example.com", ["customer"]);
    const updated = await container.updateUserStatus.execute({
        targetUserId: target.id,
        status: "suspended",
        actorId: admin.id,
        actorRoles: ["admin"],
        reason: "Suspicious activity",
    });
    strict_1.default.equal(updated.status, "suspended");
    const lastLog = container.repos.auditLogRepo.entries[container.repos.auditLogRepo.entries.length - 1];
    strict_1.default.equal(lastLog.action, "admin.user.status_changed");
});
(0, node_test_1.test)("UpdateUserStatusUseCase: a user cannot suspend/ban themselves, but can 'activate' (no-op safety)", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    await strict_1.default.rejects(() => container.updateUserStatus.execute({
        targetUserId: admin.id,
        status: "suspended",
        actorId: admin.id,
        actorRoles: ["admin"],
    }), AppError_1.ValidationError);
});
(0, node_test_1.test)("UpdateUserStatusUseCase: a plain admin cannot moderate a super_admin", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    const superAdmin = await makeUser(container, "Super", "super@example.com", ["super_admin"]);
    await strict_1.default.rejects(() => container.updateUserStatus.execute({
        targetUserId: superAdmin.id,
        status: "banned",
        actorId: admin.id,
        actorRoles: ["admin"],
    }), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("AdminDeleteUserUseCase: soft-deletes a user and revokes sessions; cannot delete self", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    const target = await makeUser(container, "Target", "target2@example.com", ["customer"]);
    await container.adminDeleteUser.execute({ targetUserId: target.id, actorId: admin.id, actorRoles: ["admin"] });
    const stored = container.repos.userRepo.users.get(target.id);
    strict_1.default.ok(stored?.deletedAt);
    await strict_1.default.rejects(() => container.adminDeleteUser.execute({ targetUserId: admin.id, actorId: admin.id, actorRoles: ["admin"] }), AppError_1.ValidationError);
});
(0, node_test_1.test)("AdminResetUserPasswordUseCase: triggers a password_reset OTP without exposing a plaintext password", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    const target = await makeUser(container, "Target", "target3@example.com", ["customer"]);
    await container.adminResetUserPassword.execute({
        targetUserId: target.id,
        actorId: admin.id,
        actorRoles: ["admin"],
    });
    const otps = [...container.repos.otpRepo.codes.values()].filter((o) => o.userId === target.id);
    strict_1.default.equal(otps.length, 1);
    strict_1.default.equal(otps[0].purpose, "password_reset");
});
(0, node_test_1.test)("UpdateUserRolesUseCase: reconciles roles (adds and removes), only super_admin can grant super_admin", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
    const target = await makeUser(container, "Target", "target4@example.com", ["customer"]);
    const updated = await container.updateUserRoles.execute({
        targetUserId: target.id,
        roleNames: ["property_owner"],
        actorId: admin.id,
        actorRoles: ["admin"],
    });
    strict_1.default.deepEqual(updated.roles?.slice().sort(), ["property_owner"]);
    await strict_1.default.rejects(() => container.updateUserRoles.execute({
        targetUserId: target.id,
        roleNames: ["super_admin"],
        actorId: admin.id,
        actorRoles: ["admin"],
    }), AppError_1.ValidationError);
});
(0, node_test_1.test)("GetUserActivityUseCase: paginates a user's activity log, 404s for unknown user", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const target = await makeUser(container, "Target", "target5@example.com", ["customer"]);
    await container.repos.activityLogRepo.record({ userId: target.id, action: "login" });
    await container.repos.activityLogRepo.record({ userId: target.id, action: "profile_updated" });
    const result = await container.getUserActivity.execute({ targetUserId: target.id, page: 1, pageSize: 10 });
    strict_1.default.equal(result.total, 2);
    await strict_1.default.rejects(() => container.getUserActivity.execute({
        targetUserId: "00000000-0000-0000-0000-000000000000",
        page: 1,
        pageSize: 10,
    }), AppError_1.NotFoundError);
});
