"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryActivityLogRepository = void 0;
const ids_1 = require("./ids");
class InMemoryActivityLogRepository {
    entries = [];
    async record(entry) {
        this.entries.push({ ...entry, id: (0, ids_1.newId)(), createdAt: new Date() });
    }
    async listForUser(userId, page, pageSize) {
        const all = this.entries
            .filter((e) => e.userId === userId)
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
}
exports.InMemoryActivityLogRepository = InMemoryActivityLogRepository;
