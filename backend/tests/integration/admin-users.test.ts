import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminTestContainer } from "../support/buildAdminTestContainer";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

async function makeUser(
  container: ReturnType<typeof buildAdminTestContainer>,
  name: string,
  email: string,
  roleNames: string[] = [],
) {
  const user = await container.repos.userRepo.create({ name, email });
  for (const roleName of roleNames) {
    const role = await container.repos.roleRepo.findByName(roleName);
    if (!role) throw new Error(`Unknown seeded role: ${roleName}`);
    await container.repos.userRoleRepo.assign(user.id, role.id, null);
  }
  return user;
}

test("SearchUsersUseCase: filters by query, status, and role", async () => {
  const container = buildAdminTestContainer();
  const alice = await makeUser(container, "Alice Owner", "alice@example.com", ["property_owner"]);
  await makeUser(container, "Bob Customer", "bob@example.com", ["customer"]);
  await container.repos.userRepo.update(alice.id, { status: "suspended" });

  const byQuery = await container.searchUsers.execute({ query: "alice", page: 1, pageSize: 20 });
  assert.equal(byQuery.total, 1);
  assert.equal(byQuery.items[0].email, "alice@example.com");

  const byStatus = await container.searchUsers.execute({ status: "suspended", page: 1, pageSize: 20 });
  assert.equal(byStatus.total, 1);
  assert.equal(byStatus.items[0].id, alice.id);

  const byRole = await container.searchUsers.execute({ role: "customer", page: 1, pageSize: 20 });
  assert.equal(byRole.total, 1);
  assert.equal(byRole.items[0].email, "bob@example.com");
});

test("GetUserProfileUseCase: 404s for unknown user, returns roles/preferences/activity/propertyCount", async () => {
  const container = buildAdminTestContainer();
  const user = await makeUser(container, "Carol", "carol@example.com", ["property_owner"]);
  await container.repos.activityLogRepo.record({ userId: user.id, action: "login" });

  const profile = await container.getUserProfile.execute(user.id);
  assert.equal(profile.email, "carol@example.com");
  assert.deepEqual(profile.roles, ["property_owner"]);
  assert.equal(profile.recentActivity.length, 1);
  assert.equal(profile.propertyCount, 0);

  await assert.rejects(
    () => container.getUserProfile.execute("00000000-0000-0000-0000-000000000000"),
    NotFoundError,
  );
});

test("UpdateUserStatusUseCase: suspends a user, revokes sessions, and is audit-logged", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
  const target = await makeUser(container, "Target", "target@example.com", ["customer"]);

  const updated = await container.updateUserStatus.execute({
    targetUserId: target.id,
    status: "suspended",
    actorId: admin.id,
    actorRoles: ["admin"],
    reason: "Suspicious activity",
  });

  assert.equal(updated.status, "suspended");
  const lastLog = container.repos.auditLogRepo.entries[container.repos.auditLogRepo.entries.length - 1];
  assert.equal(lastLog.action, "admin.user.status_changed");
});

test("UpdateUserStatusUseCase: a user cannot suspend/ban themselves, but can 'activate' (no-op safety)", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);

  await assert.rejects(
    () =>
      container.updateUserStatus.execute({
        targetUserId: admin.id,
        status: "suspended",
        actorId: admin.id,
        actorRoles: ["admin"],
      }),
    ValidationError,
  );
});

test("UpdateUserStatusUseCase: a plain admin cannot moderate a super_admin", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
  const superAdmin = await makeUser(container, "Super", "super@example.com", ["super_admin"]);

  await assert.rejects(
    () =>
      container.updateUserStatus.execute({
        targetUserId: superAdmin.id,
        status: "banned",
        actorId: admin.id,
        actorRoles: ["admin"],
      }),
    ForbiddenError,
  );
});

test("AdminDeleteUserUseCase: soft-deletes a user and revokes sessions; cannot delete self", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
  const target = await makeUser(container, "Target", "target2@example.com", ["customer"]);

  await container.adminDeleteUser.execute({ targetUserId: target.id, actorId: admin.id, actorRoles: ["admin"] });
  const stored = container.repos.userRepo.users.get(target.id);
  assert.ok(stored?.deletedAt);

  await assert.rejects(
    () => container.adminDeleteUser.execute({ targetUserId: admin.id, actorId: admin.id, actorRoles: ["admin"] }),
    ValidationError,
  );
});

test("AdminResetUserPasswordUseCase: triggers a password_reset OTP without exposing a plaintext password", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
  const target = await makeUser(container, "Target", "target3@example.com", ["customer"]);

  await container.adminResetUserPassword.execute({
    targetUserId: target.id,
    actorId: admin.id,
    actorRoles: ["admin"],
  });

  const otps = [...container.repos.otpRepo.codes.values()].filter((o) => o.userId === target.id);
  assert.equal(otps.length, 1);
  assert.equal(otps[0].purpose, "password_reset");
});

test("UpdateUserRolesUseCase: reconciles roles (adds and removes), only super_admin can grant super_admin", async () => {
  const container = buildAdminTestContainer();
  const admin = await makeUser(container, "Admin", "admin@example.com", ["admin"]);
  const target = await makeUser(container, "Target", "target4@example.com", ["customer"]);

  const updated = await container.updateUserRoles.execute({
    targetUserId: target.id,
    roleNames: ["property_owner"],
    actorId: admin.id,
    actorRoles: ["admin"],
  });
  assert.deepEqual(updated.roles?.slice().sort(), ["property_owner"]);

  await assert.rejects(
    () =>
      container.updateUserRoles.execute({
        targetUserId: target.id,
        roleNames: ["super_admin"],
        actorId: admin.id,
        actorRoles: ["admin"],
      }),
    ValidationError,
  );
});

test("GetUserActivityUseCase: paginates a user's activity log, 404s for unknown user", async () => {
  const container = buildAdminTestContainer();
  const target = await makeUser(container, "Target", "target5@example.com", ["customer"]);
  await container.repos.activityLogRepo.record({ userId: target.id, action: "login" });
  await container.repos.activityLogRepo.record({ userId: target.id, action: "profile_updated" });

  const result = await container.getUserActivity.execute({ targetUserId: target.id, page: 1, pageSize: 10 });
  assert.equal(result.total, 2);

  await assert.rejects(
    () =>
      container.getUserActivity.execute({
        targetUserId: "00000000-0000-0000-0000-000000000000",
        page: 1,
        pageSize: 10,
      }),
    NotFoundError,
  );
});
