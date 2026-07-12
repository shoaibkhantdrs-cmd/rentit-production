import test from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";

test("getMe returns the public profile, roles, and default preferences", async () => {
  const c = buildTestContainer();
  const { user } = await c.registerUser.execute({ name: "Me", email: "me@example.com", device: TEST_DEVICE });

  const me = await c.getMe.execute(user.id);

  assert.equal(me.email, "me@example.com");
  assert.deepEqual(me.roles, ["customer"]);
  assert.ok(me.preferences);
  assert.equal(me.preferences?.notifyEmail, true);
});

test("getMe throws NotFoundError for a soft-deleted user", async () => {
  const c = buildTestContainer();
  const { user } = await c.registerUser.execute({ name: "Gone", email: "gone@example.com", device: TEST_DEVICE });
  await c.deleteMe.execute(user.id);

  await assert.rejects(() => c.getMe.execute(user.id), (err: Error) => {
    assert.equal(err.constructor.name, "NotFoundError");
    return true;
  });
});

test("updateMe changes the name and preferences, and logs activity", async () => {
  const c = buildTestContainer();
  const { user } = await c.registerUser.execute({ name: "Old Name", email: "update@example.com", device: TEST_DEVICE });

  const updated = await c.updateMe.execute({
    userId: user.id,
    name: "New Name",
    preferences: { notifySms: true, language: "fr" },
  });

  assert.equal(updated.name, "New Name");
  assert.equal(updated.preferences?.notifySms, true);
  assert.equal(updated.preferences?.language, "fr");

  const activity = c.repos.activityLogRepo.entries.filter((e) => e.action === "profile.updated");
  assert.equal(activity.length, 1);
});

test("updateMe changing phone resets phoneVerifiedAt and sends a new verification OTP", async () => {
  const c = buildTestContainer("135790");
  const { user } = await c.registerUser.execute({
    name: "Phone Changer",
    email: "phonechange@example.com",
    phone: "+14155550111",
    device: TEST_DEVICE,
  });

  // Verify the original phone first.
  await c.verifyOtp.execute({
    identifier: "phonechange@example.com",
    purpose: "phone_verification",
    code: "135790",
    device: TEST_DEVICE,
  });
  let me = await c.getMe.execute(user.id);
  assert.equal(me.phoneVerified, true);

  c.notificationSender.sent.length = 0;
  await c.updateMe.execute({ userId: user.id, phone: "+14155550999" });

  me = await c.getMe.execute(user.id);
  assert.equal(me.phone, "+14155550999");
  assert.equal(me.phoneVerified, false, "changing phone must reset verification");
  assert.equal(c.notificationSender.sent.length, 1, "a fresh phone_verification OTP should be sent");
});

test("updateMe rejects a phone number already used by a different account", async () => {
  const c = buildTestContainer();
  await c.registerUser.execute({ name: "First", email: "first@example.com", phone: "+14155551000", device: TEST_DEVICE });
  const { user: second } = await c.registerUser.execute({ name: "Second", email: "second@example.com", device: TEST_DEVICE });

  await assert.rejects(
    () => c.updateMe.execute({ userId: second.id, phone: "+14155551000" }),
    (err: Error) => {
      assert.equal(err.constructor.name, "ConflictError");
      return true;
    },
  );
});

test("deleteMe soft-deletes the account and revokes all sessions", async () => {
  const c = buildTestContainer();
  const { user, refreshToken } = await c.registerUser.execute({
    name: "Delete Me",
    email: "deleteme@example.com",
    device: TEST_DEVICE,
  });

  await c.deleteMe.execute(user.id);

  await assert.rejects(() => c.refreshToken.execute({ refreshToken, ipAddress: null, userAgent: null }));
  assert.ok(c.repos.userRepo.users.get(user.id)?.deletedAt, "user row should be soft-deleted, not removed");
});

test("notifications: list, filter unread, and mark read", async () => {
  const c = buildTestContainer();
  const { user } = await c.registerUser.execute({
    name: "Notify Me",
    email: "notify@example.com",
    phone: "+14155552000",
    device: TEST_DEVICE,
  });
  // register already created 2 notifications (email + phone verification prompts)

  const all = await c.listNotifications.execute({ userId: user.id, page: 1, pageSize: 20 });
  assert.equal(all.total, 2);

  const unread = await c.listNotifications.execute({
    userId: user.id,
    page: 1,
    pageSize: 20,
    unreadOnly: true,
  });
  assert.equal(unread.total, 2);

  const idsToMark = [unread.items[0].id];
  const { updated } = await c.markNotificationsRead.execute({ userId: user.id, ids: idsToMark });
  assert.equal(updated, 1);

  const stillUnread = await c.listNotifications.execute({
    userId: user.id,
    page: 1,
    pageSize: 20,
    unreadOnly: true,
  });
  assert.equal(stillUnread.total, 1);

  const { updated: markedRest } = await c.markNotificationsRead.execute({ userId: user.id });
  assert.equal(markedRest, 1);

  const noneUnread = await c.listNotifications.execute({
    userId: user.id,
    page: 1,
    pageSize: 20,
    unreadOnly: true,
  });
  assert.equal(noneUnread.total, 0);
});

test("notifications: pagination returns the correct page and total", async () => {
  const c = buildTestContainer();
  const { user } = await c.registerUser.execute({ name: "Paginate", email: "paginate@example.com", device: TEST_DEVICE });

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
  assert.equal(page1.total, 6);
  assert.equal(page1.items.length, 3);

  const page2 = await c.listNotifications.execute({ userId: user.id, page: 2, pageSize: 3 });
  assert.equal(page2.items.length, 3);
});
