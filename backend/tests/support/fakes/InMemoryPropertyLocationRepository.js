"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyLocationRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyLocationRepository {
    // Keyed by propertyId -- there is at most one location row per property (1:1).
    byPropertyId = new Map();
    async findByPropertyId(propertyId) {
        return this.byPropertyId.get(propertyId) ?? null;
    }
    async findByPropertyIds(propertyIds) {
        const idSet = new Set(propertyIds);
        return Array.from(this.byPropertyId.values()).filter((loc) => idSet.has(loc.propertyId));
    }
    async upsert(input) {
        const existing = this.byPropertyId.get(input.propertyId);
        const now = new Date();
        const location = {
            id: existing?.id ?? (0, ids_1.newId)(),
            ...input,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        this.byPropertyId.set(input.propertyId, location);
        return location;
    }
}
exports.InMemoryPropertyLocationRepository = InMemoryPropertyLocationRepository;
