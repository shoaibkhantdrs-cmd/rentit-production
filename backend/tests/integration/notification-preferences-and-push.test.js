"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
(0, node_test_1.test)("GetNotificationPreferencesUseCase: defaults everything to on for a brand-new user", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const user = await container.repos.userRepo.create({ name: "New User", email: "newuser@example.com" });
    const prefs = await container.getNotificationPreferences.execute(user.id);
    strict_1.default.equal(prefs.notifyEmail, true);
    strict_1.default.equal(prefs.notifyPush, true);
    strict_1.default.deepEqual(prefs.categories, {
        newProperties: true,
        newMessages: true,
        favoriteUpdates: true,
        adminAnnouncements: true,
    });
});
(0, node_test_1.test)("UpdateNotificationPreferencesUseCase: partial updates merge instead of clobbering", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const user = await container.repos.userRepo.create({ name: "User", email: "user@example.com" });
    await container.updateNotificationPreferences.execute({
        userId: user.id,
        categories: { newMessages: false },
    });
    const prefs = await container.getNotificationPreferences.execute(user.id);
    strict_1.default.equal(prefs.categories.newMessages, false);
    // Everything else should be untouched by the partial update.
    strict_1.default.equal(prefs.categories.newProperties, true);
    strict_1.default.equal(prefs.categories.favoriteUpdates, true);
    strict_1.default.equal(prefs.notifyEmail, true);
});
(0, node_test_1.test)("Disabling newMessages stops push notifications for chat but not the in-app record", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const alice = await container.repos.userRepo.create({ name: "Alice", email: "alice-np@example.com" });
    const bob = await container.repos.userRepo.create({ name: "Bob", email: "bob-np@example.com" });
    await container.updateNotificationPreferences.execute({
        userId: bob.id,
        categories: { newMessages: false },
    });
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    await container.sendMessage.execute({ conversationId: conversation.id, senderId: alice.id, body: "hello" });
    strict_1.default.equal(container.pushService.sent.length, 0, "push should be suppressed");
    const bobNotifications = await container.repos.notificationRepo.listForUser(bob.id, { page: 1, pageSize: 10 });
    strict_1.default.equal(bobNotifications.total, 1, "the in-app notification should still be recorded");
});
(0, node_test_1.test)("RegisterPushTokenUseCase: registers, and clearing with null removes it from delivery targets", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const user = await container.repos.userRepo.create({ name: "Mobile User", email: "mobile@example.com" });
    await container.registerPushToken.execute({
        userId: user.id,
        deviceId: "device-abc",
        platform: "android",
        userAgent: "RentItApp/1.0 Android",
        pushToken: "fcm-token-123",
    });
    const tokens = await container.repos.userDeviceRepo.listPushTokensForUsers([user.id]);
    strict_1.default.deepEqual(tokens, [{ userId: user.id, pushToken: "fcm-token-123" }]);
    await container.registerPushToken.execute({
        userId: user.id,
        deviceId: "device-abc",
        platform: "android",
        userAgent: "RentItApp/1.0 Android",
        pushToken: null,
    });
    const tokensAfterClear = await container.repos.userDeviceRepo.listPushTokensForUsers([user.id]);
    strict_1.default.deepEqual(tokensAfterClear, []);
});
