"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryMessageRepository = void 0;
const crypto_1 = require("crypto");
class InMemoryMessageRepository {
    clock;
    messages = [];
    /** Takes the same injected clock every other timestamped fake in this
     * test suite uses (InMemoryPropertyViewRepository, etc.) -- without it,
     * a message's real-wall-clock createdAt could never line up with a
     * MarkConversationReadUseCase call driven by a FakeClock frozen at a
     * fixed instant, making unread-count assertions flaky by construction. */
    constructor(clock) {
        this.clock = clock;
    }
    async create(input) {
        const now = this.clock.now();
        const message = {
            id: (0, crypto_1.randomUUID)(),
            conversationId: input.conversationId,
            senderId: input.senderId,
            body: input.body ?? null,
            imageUrl: input.imageUrl ?? null,
            imagePublicId: input.imagePublicId ?? null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
        this.messages.push(message);
        return message;
    }
    async findById(id) {
        return this.messages.find((m) => m.id === id) ?? null;
    }
    async listForConversation(conversationId, page, pageSize) {
        const all = this.messages
            .filter((m) => m.conversationId === conversationId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const start = (page - 1) * pageSize;
        const page_ = all.slice(start, start + pageSize).reverse();
        return { items: page_, total: all.length };
    }
    async softDelete(id) {
        const message = this.messages.find((m) => m.id === id);
        if (message)
            message.deletedAt = new Date();
    }
}
exports.InMemoryMessageRepository = InMemoryMessageRepository;
