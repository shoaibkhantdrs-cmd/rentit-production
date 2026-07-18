"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyFeatureRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyFeatureRepository {
    byPropertyId = new Map();
    async listForProperty(propertyId) {
        return this.byPropertyId.get(propertyId) ?? [];
    }
    async listForProperties(propertyIds) {
        const idSet = new Set(propertyIds);
        const out = [];
        for (const [propertyId, features] of this.byPropertyId.entries()) {
            if (idSet.has(propertyId))
                out.push(...features);
        }
        return out;
    }
    async setForProperty(propertyId, featureKeys) {
        const now = new Date();
        const features = featureKeys.map((key) => ({
            id: (0, ids_1.newId)(),
            propertyId,
            featureKey: key,
            createdAt: now,
        }));
        this.byPropertyId.set(propertyId, features);
    }
}
exports.InMemoryPropertyFeatureRepository = InMemoryPropertyFeatureRepository;
