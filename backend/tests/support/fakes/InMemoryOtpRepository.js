"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryOtpRepository = void 0;
const ids_1 = require("./ids");
class InMemoryOtpRepository {
    clock;
    codes = new Map();
    constructor(clock) {
        this.clock = clock;
    }
    async create(input) {
        const now = this.clock.now();
        const code = {
            id: (0, ids_1.newId)(),
            userId: input.userId,
            purpose: input.purpose,
            channel: input.channel,
            codeHash: input.codeHash,
            attempts: 0,
            maxAttempts: input.maxAttempts,
            expiresAt: input.expiresAt,
            consumedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        this.codes.set(code.id, code);
        return code;
    }
    async findActive(userId, purpose) {
        const now = this.clock.now().getTime();
        const candidates = [...this.codes.values()]
            .filter((c) => c.userId === userId && c.purpose === purpose && !c.consumedAt && c.expiresAt.getTime() > now)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return candidates[0] ?? null;
    }
    async incrementAttempts(id) {
        const existing = this.codes.get(id);
        if (!existing)
            throw new Error(`OTP ${id} not found`);
        const updated = { ...existing, attempts: existing.attempts + 1, updatedAt: this.clock.now() };
        this.codes.set(id, updated);
        return updated;
    }
    async consume(id) {
        const existing = this.codes.get(id);
        if (!existing)
            return;
        this.codes.set(id, { ...existing, consumedAt: this.clock.now(), updatedAt: this.clock.now() });
    }
}
exports.InMemoryOtpRepository = InMemoryOtpRepository;
