"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyFavoriteRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyFavoriteRepository {
    favorites = new Map();
    key(propertyId, userId) {
        return `${propertyId}:${userId}`;
    }
    async add(propertyId, userId) {
        const key = this.key(propertyId, userId);
        if (this.favorites.has(key))
            return false;
        this.favorites.set(key, { id: (0, ids_1.newId)(), propertyId, userId, createdAt: new Date() });
        return true;
    }
    async remove(propertyId, userId) {
        return this.favorites.delete(this.key(propertyId, userId));
    }
    async exists(propertyId, userId) {
        return this.favorites.has(this.key(propertyId, userId));
    }
    async listFavoritedPropertyIds(userId, propertyIds) {
        const idSet = new Set(propertyIds);
        return Array.from(this.favorites.values())
            .filter((f) => f.userId === userId && idSet.has(f.propertyId))
            .map((f) => f.propertyId);
    }
    async listPropertyIdsForUser(userId, page, pageSize) {
        // Most-recently-favorited first, mirroring "ORDER BY created_at DESC".
        const all = Array.from(this.favorites.values())
            .filter((f) => f.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        const ids = all.slice(offset, offset + pageSize).map((f) => f.propertyId);
        return { ids, total: all.length };
    }
}
exports.InMemoryPropertyFavoriteRepository = InMemoryPropertyFavoriteRepository;
