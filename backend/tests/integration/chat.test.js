"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
const AppError_1 = require("@/domain/errors/AppError");
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
async function makeUsers(container) {
    const alice = await container.repos.userRepo.create({ name: "Alice", email: `alice-${Date.now()}-${Math.random()}@example.com` });
    const bob = await container.repos.userRepo.create({ name: "Bob", email: `bob-${Date.now()}-${Math.random()}@example.com` });
    return { alice, bob };
}
(0, node_test_1.test)("StartConversationUseCase: creates a conversation and is idempotent", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const first = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    const second = await container.startConversation.execute({ initiatorId: bob.id, recipientId: alice.id });
    strict_1.default.equal(first?.id, second?.id, "starting from either side should return the same thread");
});
(0, node_test_1.test)("StartConversationUseCase: rejects messaging yourself and nonexistent users", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice } = await makeUsers(container);
    await strict_1.default.rejects(() => container.startConversation.execute({ initiatorId: alice.id, recipientId: alice.id }), AppError_1.ValidationError);
    await strict_1.default.rejects(() => container.startConversation.execute({
        initiatorId: alice.id,
        recipientId: "00000000-0000-0000-0000-000000000099",
    }), AppError_1.NotFoundError);
});
(0, node_test_1.test)("SendMessageUseCase: delivers text, records preview, notifies, and pushes over the realtime gateway", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    const message = await container.sendMessage.execute({
        conversationId: conversation.id,
        senderId: alice.id,
        body: "Is this still available?",
    });
    strict_1.default.equal(message.body, "Is this still available?");
    strict_1.default.equal(message.senderId, alice.id);
    const bobNotifications = await container.repos.notificationRepo.listForUser(bob.id, { page: 1, pageSize: 10 });
    strict_1.default.equal(bobNotifications.total, 1);
    strict_1.default.equal(bobNotifications.items[0].type, "chat_message");
    strict_1.default.equal(container.pushService.sent.length, 1);
    strict_1.default.equal(container.pushService.sent[0].userId, bob.id);
    const events = container.realtimeGateway.published.filter((p) => p.event.type === "message.new");
    strict_1.default.equal(events.length, 1);
    strict_1.default.deepEqual(events[0].recipientUserIds, [bob.id]);
});
(0, node_test_1.test)("SendMessageUseCase: an image-only message is valid, a completely empty one is not", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    const imageMessage = await container.sendMessage.execute({
        conversationId: conversation.id,
        senderId: alice.id,
        image: { buffer: Buffer.from("fake-jpeg-bytes") },
    });
    strict_1.default.equal(imageMessage.body, null);
    strict_1.default.ok(imageMessage.imageUrl);
    await strict_1.default.rejects(() => container.sendMessage.execute({ conversationId: conversation.id, senderId: alice.id }), AppError_1.ValidationError);
});
(0, node_test_1.test)("SendMessageUseCase: only participants may post into a conversation", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const eve = await container.repos.userRepo.create({ name: "Eve", email: `eve-${Date.now()}@example.com` });
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    await strict_1.default.rejects(() => container.sendMessage.execute({ conversationId: conversation.id, senderId: eve.id, body: "hi" }), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("Unread counts and read receipts move correctly as messages are sent and read", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    await container.sendMessage.execute({ conversationId: conversation.id, senderId: alice.id, body: "one" });
    await container.sendMessage.execute({ conversationId: conversation.id, senderId: alice.id, body: "two" });
    const bobUnread = await container.getUnreadMessageCount.execute(bob.id);
    strict_1.default.equal(bobUnread.unreadCount, 2);
    const bobList = await container.listConversations.execute({ userId: bob.id, page: 1, pageSize: 10 });
    strict_1.default.equal(bobList.items[0].unreadCount, 2);
    strict_1.default.equal(bobList.items[0].otherParticipant?.id, alice.id);
    strict_1.default.equal(bobList.items[0].lastMessagePreview, "two");
    // Before Bob reads, Alice shouldn't see her messages as read yet.
    const aliceMessagesBefore = await container.listMessages.execute({
        conversationId: conversation.id,
        requesterId: alice.id,
        page: 1,
        pageSize: 10,
    });
    strict_1.default.ok(aliceMessagesBefore.items.every((m) => !m.readByOther));
    await container.markConversationRead.execute({ conversationId: conversation.id, userId: bob.id });
    const bobUnreadAfter = await container.getUnreadMessageCount.execute(bob.id);
    strict_1.default.equal(bobUnreadAfter.unreadCount, 0);
    const aliceMessagesAfter = await container.listMessages.execute({
        conversationId: conversation.id,
        requesterId: alice.id,
        page: 1,
        pageSize: 10,
    });
    strict_1.default.ok(aliceMessagesAfter.items.every((m) => m.readByOther));
    const readEvents = container.realtimeGateway.published.filter((p) => p.event.type === "conversation.read");
    strict_1.default.equal(readEvents.length, 1);
    strict_1.default.deepEqual(readEvents[0].recipientUserIds, [alice.id]);
});
(0, node_test_1.test)("DeleteMessageUseCase: soft-deletes for the sender only, hides content, broadcasts the deletion", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    const message = await container.sendMessage.execute({
        conversationId: conversation.id,
        senderId: alice.id,
        body: "oops, wrong chat",
    });
    await strict_1.default.rejects(() => container.deleteMessage.execute({
        conversationId: conversation.id,
        messageId: message.id,
        requesterId: bob.id,
    }), AppError_1.ForbiddenError, "the recipient should not be able to delete someone else's message");
    await container.deleteMessage.execute({
        conversationId: conversation.id,
        messageId: message.id,
        requesterId: alice.id,
    });
    const bobView = await container.listMessages.execute({
        conversationId: conversation.id,
        requesterId: bob.id,
        page: 1,
        pageSize: 10,
    });
    const deleted = bobView.items.find((m) => m.id === message.id);
    strict_1.default.equal(deleted?.isDeleted, true);
    strict_1.default.equal(deleted?.body, null);
    const deleteEvents = container.realtimeGateway.published.filter((p) => p.event.type === "message.deleted");
    strict_1.default.equal(deleteEvents.length, 1);
});
(0, node_test_1.test)("SendTypingIndicatorUseCase: broadcasts to the other participant only, and rejects non-participants", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { alice, bob } = await makeUsers(container);
    const eve = await container.repos.userRepo.create({ name: "Eve", email: `eve2-${Date.now()}@example.com` });
    const conversation = await container.startConversation.execute({ initiatorId: alice.id, recipientId: bob.id });
    await container.sendTypingIndicator.execute({
        conversationId: conversation.id,
        userId: alice.id,
        isTyping: true,
    });
    const typingEvents = container.realtimeGateway.published.filter((p) => p.event.type === "typing");
    strict_1.default.equal(typingEvents.length, 1);
    strict_1.default.deepEqual(typingEvents[0].recipientUserIds, [bob.id]);
    await strict_1.default.rejects(() => container.sendTypingIndicator.execute({
        conversationId: conversation.id,
        userId: eve.id,
        isTyping: true,
    }), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("Conversations can be scoped to a property", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
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
    strict_1.default.notEqual(generalThread.id, propertyThread.id);
    strict_1.default.equal(propertyThread.propertyId, property.id);
    const aliceList = await container.listConversations.execute({ userId: alice.id, page: 1, pageSize: 10 });
    strict_1.default.equal(aliceList.total, 2);
    const propertyEntry = aliceList.items.find((i) => i.id === propertyThread.id);
    strict_1.default.equal(propertyEntry?.propertyTitle, "2BHK near the park");
});
