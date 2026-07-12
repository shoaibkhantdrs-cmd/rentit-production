import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPhase5TestContainer } from "../support/buildPhase5TestContainer";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

async function makeUsers(container: ReturnType<typeof buildPhase5TestContainer>) {
  const alice = await container.repos.userRepo.create({ name: "Alice", email: `alice-${Date.now()}-${Math.random()}@example.com` });
  const bob = await container.repos.userRepo.create({ name: "Bob", email: `bob-${Date.now()}-${Math.random()}@example.com` });
  return { alice, bob };
}

test("StartConversationUseCase: creates a conversation and is idempotent", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);

  const first = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
  const second = await container.startConversation.execute({ initiatorId: bob.id, recipientId: alice.id });

  assert.equal(first?.id, second?.id, "starting from either side should return the same thread");
});

test("StartConversationUseCase: rejects messaging yourself and nonexistent users", async () => {
  const container = buildPhase5TestContainer();
  const { alice } = await makeUsers(container);

  await assert.rejects(
    () => container.startConversation.execute({ initiatorId: alice.id, recipientId: alice.id }),
    ValidationError,
  );
  await assert.rejects(
    () =>
      container.startConversation.execute({
        initiatorId: alice.id,
        recipientId: "00000000-0000-0000-0000-000000000099",
      }),
    NotFoundError,
  );
});

test("SendMessageUseCase: delivers text, records preview, notifies, and pushes over the realtime gateway", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });

  const message = await container.sendMessage.execute({
    conversationId: conversation!.id,
    senderId: alice.id,
    body: "Is this still available?",
  });

  assert.equal(message.body, "Is this still available?");
  assert.equal(message.senderId, alice.id);

  const bobNotifications = await container.repos.notificationRepo.listForUser(bob.id, { page: 1, pageSize: 10 });
  assert.equal(bobNotifications.total, 1);
  assert.equal(bobNotifications.items[0].type, "chat_message");

  assert.equal(container.pushService.sent.length, 1);
  assert.equal(container.pushService.sent[0].userId, bob.id);

  const events = container.realtimeGateway.published.filter((p) => p.event.type === "message.new");
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].recipientUserIds, [bob.id]);
});

test("SendMessageUseCase: an image-only message is valid, a completely empty one is not", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });

  const imageMessage = await container.sendMessage.execute({
    conversationId: conversation!.id,
    senderId: alice.id,
    image: { buffer: Buffer.from("fake-jpeg-bytes") },
  });
  assert.equal(imageMessage.body, null);
  assert.ok(imageMessage.imageUrl);

  await assert.rejects(
    () => container.sendMessage.execute({ conversationId: conversation!.id, senderId: alice.id }),
    ValidationError,
  );
});

test("SendMessageUseCase: only participants may post into a conversation", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const eve = await container.repos.userRepo.create({ name: "Eve", email: `eve-${Date.now()}@example.com` });
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });

  await assert.rejects(
    () => container.sendMessage.execute({ conversationId: conversation!.id, senderId: eve.id, body: "hi" }),
    ForbiddenError,
  );
});

test("Unread counts and read receipts move correctly as messages are sent and read", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });

  await container.sendMessage.execute({ conversationId: conversation!.id, senderId: alice.id, body: "one" });
  await container.sendMessage.execute({ conversationId: conversation!.id, senderId: alice.id, body: "two" });

  const bobUnread = await container.getUnreadMessageCount.execute(bob.id);
  assert.equal(bobUnread.unreadCount, 2);

  const bobList = await container.listConversations.execute({ userId: bob.id, page: 1, pageSize: 10 });
  assert.equal(bobList.items[0].unreadCount, 2);
  assert.equal(bobList.items[0].otherParticipant?.id, alice.id);
  assert.equal(bobList.items[0].lastMessagePreview, "two");

  // Before Bob reads, Alice shouldn't see her messages as read yet.
  const aliceMessagesBefore = await container.listMessages.execute({
    conversationId: conversation!.id,
    requesterId: alice.id,
    page: 1,
    pageSize: 10,
  });
  assert.ok(aliceMessagesBefore.items.every((m) => !m.readByOther));

  await container.markConversationRead.execute({ conversationId: conversation!.id, userId: bob.id });

  const bobUnreadAfter = await container.getUnreadMessageCount.execute(bob.id);
  assert.equal(bobUnreadAfter.unreadCount, 0);

  const aliceMessagesAfter = await container.listMessages.execute({
    conversationId: conversation!.id,
    requesterId: alice.id,
    page: 1,
    pageSize: 10,
  });
  assert.ok(aliceMessagesAfter.items.every((m) => m.readByOther));

  const readEvents = container.realtimeGateway.published.filter((p) => p.event.type === "conversation.read");
  assert.equal(readEvents.length, 1);
  assert.deepEqual(readEvents[0].recipientUserIds, [alice.id]);
});

test("DeleteMessageUseCase: soft-deletes for the sender only, hides content, broadcasts the deletion", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
  const message = await container.sendMessage.execute({
    conversationId: conversation!.id,
    senderId: alice.id,
    body: "oops, wrong chat",
  });

  await assert.rejects(
    () =>
      container.deleteMessage.execute({
        conversationId: conversation!.id,
        messageId: message.id,
        requesterId: bob.id,
      }),
    ForbiddenError,
    "the recipient should not be able to delete someone else's message",
  );

  await container.deleteMessage.execute({
    conversationId: conversation!.id,
    messageId: message.id,
    requesterId: alice.id,
  });

  const bobView = await container.listMessages.execute({
    conversationId: conversation!.id,
    requesterId: bob.id,
    page: 1,
    pageSize: 10,
  });
  const deleted = bobView.items.find((m) => m.id === message.id);
  assert.equal(deleted?.isDeleted, true);
  assert.equal(deleted?.body, null);

  const deleteEvents = container.realtimeGateway.published.filter((p) => p.event.type === "message.deleted");
  assert.equal(deleteEvents.length, 1);
});

test("SendTypingIndicatorUseCase: broadcasts to the other participant only, and rejects non-participants", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const eve = await container.repos.userRepo.create({ name: "Eve", email: `eve2-${Date.now()}@example.com` });
  const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });

  await container.sendTypingIndicator.execute({
    conversationId: conversation!.id,
    userId: alice.id,
    isTyping: true,
  });

  const typingEvents = container.realtimeGateway.published.filter((p) => p.event.type === "typing");
  assert.equal(typingEvents.length, 1);
  assert.deepEqual(typingEvents[0].recipientUserIds, [bob.id]);

  await assert.rejects(
    () =>
      container.sendTypingIndicator.execute({
        conversationId: conversation!.id,
        userId: eve.id,
        isTyping: true,
      }),
    ForbiddenError,
  );
});

test("Conversations can be scoped to a property", async () => {
  const container = buildPhase5TestContainer();
  const { alice, bob } = await makeUsers(container);
  const property = await container.repos.propertyRepo.create({
    ownerId: bob.id,
    categoryId: CATEGORY_ID,
    title: "2BHK near the park",
    description: "desc",
    propertyType: "apartment",
    rentAmount: 18000,
    securityDeposit: 36000,
    areaSqft: 750,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    furnishedStatus: "unfurnished",
    availableFrom: "2026-08-01",
  });

  const generalThread = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
  const propertyThread = await container.startConversation.execute({
    initiatorId: alice.id,
    recipientId: bob.id,
    propertyId: property.id,
  });

  assert.notEqual(generalThread!.id, propertyThread!.id);
  assert.equal(propertyThread!.propertyId, property.id);

  const aliceList = await container.listConversations.execute({ userId: alice.id, page: 1, pageSize: 10 });
  assert.equal(aliceList.total, 2);
  const propertyEntry = aliceList.items.find((i) => i.id === propertyThread!.id);
  assert.equal(propertyEntry?.propertyTitle, "2BHK near the park");
});
