import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPhase5TestContainer } from "../support/buildPhase5TestContainer";

test("GetNotificationPreferencesUseCase: defaults everything to on for a brand-new user", async () => {
  const container = buildPhase5TestContainer();
  const user = await container.repos.userRepo.create({ name: "New User", email: "newuser@example.com" });

  const prefs = await container.getNotificationPreferences.execute(user.id);
  assert.equal(prefs.notifyEmail, true);
  assert.equal(prefs.notifyPush, true);
  assert.deepEqual(prefs.categories, {
    newProperties: true,
    newMessages: true,
    favoriteUpdates: true,
    adminAnnouncements: true,
  });
});

test("UpdateNotificationPreferencesUseCase: partial updates merge instead of clobbering", async () => {
  const container = buildPhase5TestContainer();
  const user = await container.repos.userRepo.create({ name: "User", email: "user@example.com" });

  await container.updateNotificationPreferences.execute({
    userId: user.id,
    categories: { newMessages: false },
  });

  const prefs = await container.getNotificationPreferences.execute(user.id);
  assert.equal(prefs.categories.newMessages, false);
  // Everything else should be untouched by the partial update.
  assert.equal(prefs.categories.newProperties, true);
  assert.equal(prefs.categories.favoriteUpdates, true);
  assert.equal(prefs.notifyEmail, true);
});

test("Disabling newMessages stops push notifications for chat but not the in-app record", async () => {
  const container = buildPhase5TestContainer();
  const alice = await container.repos.userRepo.create({ name: "Alice", email: "alice-np@example.com" });
  const bob = await container.repos.userRepo.create({ name: "Bob", email: "bob-np@example.com" });

  await container.updateNotificationPreferences.execute({
    userId: bob.id,
    categories: { newMessages: false },
  });

  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
  await container.sendMessage.execute({ conversationId: conversation!.id, senderId: alice.id, body: "hello" });

  assert.equal(container.pushService.sent.length, 0, "push should be suppressed");
  const bobNotifications = await container.repos.notificationRepo.listForUser(bob.id, { page: 1, pageSize: 10 });
  assert.equal(bobNotifications.total, 1, "the in-app notification should still be recorded");
});

test("RegisterPushTokenUseCase: registers, and clearing with null removes it from delivery targets", async () => {
  const container = buildPhase5TestContainer();
  const user = await container.repos.userRepo.create({ name: "Mobile User", email: "mobile@example.com" });

  await container.registerPushToken.execute({
    userId: user.id,
    deviceId: "device-abc",
    platform: "android",
    userAgent: "RentItApp/1.0 Android",
    pushToken: "fcm-token-123",
  });

  const tokens = await container.repos.userDeviceRepo.listPushTokensForUsers([user.id]);
  assert.deepEqual(tokens, [{ userId: user.id, pushToken: "fcm-token-123" }]);

  await container.registerPushToken.execute({
    userId: user.id,
    deviceId: "device-abc",
    platform: "android",
    userAgent: "RentItApp/1.0 Android",
    pushToken: null,
  });

  const tokensAfterClear = await container.repos.userDeviceRepo.listPushTokensForUsers([user.id]);
  assert.deepEqual(tokensAfterClear, []);
});
