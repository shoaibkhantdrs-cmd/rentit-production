"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyStatusHistoryRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyStatusHistoryRepository {
    entries = [];
    async record(input) {
        this.entries.push({
            id: (0, ids_1.newId)(),
            propertyId: input.propertyId,
            previousStatus: input.previousStatus,
            newStatus: input.newStatus,
            changedBy: input.changedBy,
            reason: input.reason ?? null,
            createdAt: new Date(),
        });
    }
    async listForProperty(propertyId, page, pageSize) {
        const all = this.entries
            .filter((e) => e.propertyId === propertyId)
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
    async listRecent(page, pageSize) {
        const all = this.entries.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
}
exports.InMemoryPropertyStatusHistoryRepository = InMemoryPropertyStatusHistoryRepository;
