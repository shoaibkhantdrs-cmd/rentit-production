"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemorySavedSearchRepository = void 0;
const ids_1 = require("./ids");
class InMemorySavedSearchRepository {
    searches = new Map();
    async create(input) {
        const now = new Date();
        const search = {
            id: (0, ids_1.newId)(),
            userId: input.userId,
            name: input.name,
            filters: input.filters,
            notifyOnMatch: input.notifyOnMatch,
            lastNotifiedAt: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
        this.searches.set(search.id, search);
        return search;
    }
    async findById(id) {
        const search = this.searches.get(id);
        return search && !search.deletedAt ? search : null;
    }
    async listForUser(userId) {
        return [...this.searches.values()]
            .filter((s) => s.userId === userId && !s.deletedAt)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async update(id, patch) {
        const existing = this.searches.get(id);
        if (!existing)
            throw new Error(`Saved search ${id} not found`);
        const updated = {
            ...existing,
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.filters !== undefined ? { filters: patch.filters } : {}),
            ...(patch.notifyOnMatch !== undefined ? { notifyOnMatch: patch.notifyOnMatch } : {}),
            ...(patch.lastNotifiedAt !== undefined ? { lastNotifiedAt: patch.lastNotifiedAt } : {}),
            updatedAt: new Date(),
        };
        this.searches.set(id, updated);
        return updated;
    }
    async softDelete(id) {
        const existing = this.searches.get(id);
        if (existing)
            existing.deletedAt = new Date();
    }
    async listAllNotifiable() {
        return [...this.searches.values()].filter((s) => s.notifyOnMatch && !s.deletedAt);
    }
}
exports.InMemorySavedSearchRepository = InMemorySavedSearchRepository;
