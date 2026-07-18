"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
(0, node_test_1.default)("getMe returns the public profile, roles, and default preferences", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user } = await c.registerUser.execute({ name: "Me", email: "me@example.com", device: buildTestContainer_1.TEST_DEVICE });
    const me = await c.getMe.execute(user.id);
    strict_1.default.equal(me.email, "me@example.com");
    strict_1.default.deepEqual(me.roles, ["customer"]);
    strict_1.default.ok(me.preferences);
    strict_1.default.equal(me.preferences?.notifyEmail, true);
});
(0, node_test_1.default)("getMe throws NotFoundError for a soft-deleted user", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user } = await c.registerUser.execute({ name: "Gone", email: "gone@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await c.deleteMe.execute(user.id);
    await strict_1.default.rejects(() => c.getMe.execute(user.id), (err) => {
        strict_1.default.equal(err.constructor.name, "NotFoundError");
        return true;
    });
});
(0, node_test_1.default)("updateMe changes the name and preferences, and logs activity", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user } = await c.registerUser.execute({ name: "Old Name", email: "update@example.com", device: buildTestContainer_1.TEST_DEVICE });
    const updated = await c.updateMe.execute({
        userId: user.id,
        name: "New Name",
        preferences: { notifySms: true, language: "fr" },
    });
    strict_1.default.equal(updated.name, "New Name");
    strict_1.default.equal(updated.preferences?.notifySms, true);
    strict_1.default.equal(updated.preferences?.language, "fr");
    const activity = c.repos.activityLogRepo.entries.filter((e) => e.action === "profile.updated");
    strict_1.default.equal(activity.length, 1);
});
(0, node_test_1.default)("updateMe changing phone resets phoneVerifiedAt and sends a new verification OTP", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)("135790");
    const { user } = await c.registerUser.execute({
        name: "Phone Changer",
        email: "phonechange@example.com",
        phone: "+14155550111",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    // Verify the original phone first.
    await c.verifyOtp.execute({
        identifier: "phonechange@example.com",
        purpose: "phone_verification",
        code: "135790",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    let me = await c.getMe.execute(user.id);
    strict_1.default.equal(me.phoneVerified, true);
    c.notificationSender.sent.length = 0;
    await c.updateMe.execute({ userId: user.id, phone: "+14155550999" });
    me = await c.getMe.execute(user.id);
    strict_1.default.equal(me.phone, "+14155550999");
    strict_1.default.equal(me.phoneVerified, false, "changing phone must reset verification");
    strict_1.default.equal(c.notificationSender.sent.length, 1, "a fresh phone_verification OTP should be sent");
});
(0, node_test_1.default)("updateMe rejects a phone number already used by a different account", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    await c.registerUser.execute({ name: "First", email: "first@example.com", phone: "+14155551000", device: buildTestContainer_1.TEST_DEVICE });
    const { user: second } = await c.registerUser.execute({ name: "Second", email: "second@example.com", device: buildTestContainer_1.TEST_DEVICE });
    await strict_1.default.rejects(() => c.updateMe.execute({ userId: second.id, phone: "+14155551000" }), (err) => {
        strict_1.default.equal(err.constructor.name, "ConflictError");
        return true;
    });
});
(0, node_test_1.default)("deleteMe soft-deletes the account and revokes all sessions", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user, refreshToken } = await c.registerUser.execute({
        name: "Delete Me",
        email: "deleteme@example.com",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    await c.deleteMe.execute(user.id);
    await strict_1.default.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }));
    strict_1.default.ok(c.repos.userRepo.users.get(user.id)?.deletedAt, "user row should be soft-deleted, not removed");
});
(0, node_test_1.default)("notifications: list, filter unread, and mark read", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user } = await c.registerUser.execute({
        name: "Notify Me",
        email: "notify@example.com",
        phone: "+14155552000",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    // register already created 2 notifications (email + phone verification prompts)
    const all = await c.listNotifications.execute({ userId: user.id, page: 1, pageSize: 20 });
    strict_1.default.equal(all.total, 2);
    const unread = await c.listNotifications.execute({
        userId: user.id,
        page: 1,
        pageSize: 20,
        unreadOnly: true,
    });
    strict_1.default.equal(unread.total, 2);
    const idsToMark = [unread.items[0].id];
    const { updated } = await c.markNotificationsRead.execute({ userId: user.id, ids: idsToMark });
    strict_1.default.equal(updated, 1);
    const stillUnread = await c.listNotifications.execute({
        userId: user.id,
        page: 1,
        pageSize: 20,
        unreadOnly: true,
    });
    strict_1.default.equal(stillUnread.total, 1);
    const { updated: markedRest } = await c.markNotificationsRead.execute({ userId: user.id });
    strict_1.default.equal(markedRest, 1);
    const noneUnread = await c.listNotifications.execute({
        userId: user.id,
        page: 1,
        pageSize: 20,
        unreadOnly: true,
    });
    strict_1.default.equal(noneUnread.total, 0);
});
(0, node_test_1.default)("notifications: pagination returns the correct page and total", async () => {
    const c = (0, buildTestContainer_1.buildTestContainer)();
    const { user } = await c.registerUser.execute({ name: "Paginate", email: "paginate@example.com", device: buildTestContainer_1.TEST_DEVICE });
    for (let i = 0; i < 5; i += 1) {
        await c.repos.notificationRepo.create({
            userId: user.id,
            type: "test.notification",
            title: `Notification ${i}`,
            body: "body",
        });
    }
    // + 1 from register's email verification notification = 6 total
    const page1 = await c.listNotifications.execute({ userId: user.id, page: 1, pageSize: 3 });
    strict_1.default.equal(page1.total, 6);
    strict_1.default.equal(page1.items.length, 3);
    const page2 = await c.listNotifications.execute({ userId: user.id, page: 2, pageSize: 3 });
    strict_1.default.equal(page2.items.length, 3);
});
