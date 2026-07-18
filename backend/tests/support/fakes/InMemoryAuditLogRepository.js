"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryAuditLogRepository = void 0;
const ids_1 = require("./ids");
class InMemoryAuditLogRepository {
    entries = [];
    async record(entry) {
        this.entries.push({ ...entry, id: (0, ids_1.newId)(), createdAt: new Date() });
    }
    async search(filters, page, pageSize) {
        let all = this.entries.slice();
        if (filters.userId)
            all = all.filter((e) => e.userId === filters.userId);
        if (filters.action)
            all = all.filter((e) => e.action === filters.action);
        if (filters.entityType)
            all = all.filter((e) => e.entityType === filters.entityType);
        if (filters.entityId)
            all = all.filter((e) => e.entityId === filters.entityId);
        if (filters.dateFrom)
            all = all.filter((e) => e.createdAt >= filters.dateFrom);
        if (filters.dateTo)
            all = all.filter((e) => e.createdAt <= filters.dateTo);
        all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
}
exports.InMemoryAuditLogRepository = InMemoryAuditLogRepository;
