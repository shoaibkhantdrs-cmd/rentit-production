"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryRefreshTokenRepository = void 0;
const ids_1 = require("./ids");
class InMemoryRefreshTokenRepository {
    tokens = new Map();
    async create(input) {
        const now = new Date();
        const token = {
            id: (0, ids_1.newId)(),
            userId: input.userId,
            sessionId: input.sessionId,
            tokenHash: input.tokenHash,
            familyId: input.familyId,
            replacedBy: null,
            createdAt: now,
            updatedAt: now,
            expiresAt: input.expiresAt,
            revokedAt: null,
            revokedReason: null,
        };
        this.tokens.set(token.id, token);
        return token;
    }
    async findByTokenHash(tokenHash) {
        for (const token of this.tokens.values()) {
            if (token.tokenHash === tokenHash)
                return token;
        }
        return null;
    }
    async markReplaced(id, replacedById) {
        const existing = this.tokens.get(id);
        if (!existing)
            return;
        this.tokens.set(id, { ...existing, replacedBy: replacedById, updatedAt: new Date() });
    }
    async revoke(id, reason) {
        const existing = this.tokens.get(id);
        if (!existing || existing.revokedAt)
            return;
        this.tokens.set(id, {
            ...existing,
            revokedAt: new Date(),
            revokedReason: reason,
            updatedAt: new Date(),
        });
    }
    async revokeFamily(familyId, reason) {
        for (const token of this.tokens.values()) {
            if (token.familyId === familyId && !token.revokedAt) {
                this.tokens.set(token.id, {
                    ...token,
                    revokedAt: new Date(),
                    revokedReason: reason,
                    updatedAt: new Date(),
                });
            }
        }
    }
    async revokeAllForUser(userId, reason) {
        let count = 0;
        for (const token of this.tokens.values()) {
            if (token.userId === userId && !token.revokedAt) {
                this.tokens.set(token.id, {
                    ...token,
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
exports.InMemoryRefreshTokenRepository = InMemoryRefreshTokenRepository;
