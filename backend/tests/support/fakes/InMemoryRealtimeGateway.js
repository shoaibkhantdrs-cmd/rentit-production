"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryRealtimeGateway = void 0;
class InMemoryRealtimeGateway {
    published = [];
    publishToConversation(conversationId, recipientUserIds, event) {
        this.published.push({ conversationId, recipientUserIds, event });
    }
}
exports.InMemoryRealtimeGateway = InMemoryRealtimeGateway;
