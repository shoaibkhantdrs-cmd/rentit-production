"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemorySessionRepository = void 0;
const ids_1 = require("./ids");
class InMemorySessionRepository {
    sessions = new Map();
    async create(input) {
        const now = new Date();
        const session = {
            id: (0, ids_1.newId)(),
            userId: input.userId,
            deviceId: input.deviceId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            createdAt: now,
            updatedAt: now,
            lastActiveAt: now,
            expiresAt: input.expiresAt,
            revokedAt: null,
            revokedReason: null,
        };
        this.sessions.set(session.id, session);
        return session;
    }
    async findById(id) {
        return this.sessions.get(id) ?? null;
    }
    async touchLastActive(id) {
        const existing = this.sessions.get(id);
        if (!existing)
            return;
        this.sessions.set(id, { ...existing, lastActiveAt: new Date(), updatedAt: new Date() });
    }
    async revoke(id, reason) {
        const existing = this.sessions.get(id);
        if (!existing || existing.revokedAt)
            return;
        this.sessions.set(id, {
            ...existing,
            revokedAt: new Date(),
            revokedReason: reason,
            updatedAt: new Date(),
        });
    }
    async revokeAllForUser(userId, reason, exceptSessionId) {
        let count = 0;
        for (const session of this.sessions.values()) {
            if (session.userId === userId && !session.revokedAt && session.id !== exceptSessionId) {
                this.sessions.set(session.id, {
                    ...session,
                    revokedAt: new Date(),
                    revokedReason: reason,
                    updatedAt: new Date(),
                });
                count += 1;
            }
        }
        return count;
    }
}
exports.InMemorySessionRepository = InMemorySessionRepository;
