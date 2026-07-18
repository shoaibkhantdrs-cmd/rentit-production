"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyImageRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyImageRepository {
    images = new Map();
    async create(input) {
        const now = new Date();
        const image = {
            id: (0, ids_1.newId)(),
            propertyId: input.propertyId,
            cloudinaryPublicId: input.cloudinaryPublicId,
            url: input.url,
            width: input.width,
            height: input.height,
            format: input.format,
            bytes: input.bytes,
            isPrimary: input.isPrimary,
            sortOrder: input.sortOrder,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
        this.images.set(image.id, image);
        return image;
    }
    async findById(id) {
        return this.images.get(id) ?? null;
    }
    async listForProperty(propertyId) {
        return Array.from(this.images.values())
            .filter((img) => img.propertyId === propertyId && !img.deletedAt)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    async listForProperties(propertyIds) {
        const idSet = new Set(propertyIds);
        return Array.from(this.images.values())
            .filter((img) => idSet.has(img.propertyId) && !img.deletedAt)
            .sort((a, b) => a.propertyId.localeCompare(b.propertyId) || a.sortOrder - b.sortOrder);
    }
    async listPrimaryForProperties(propertyIds) {
        const idSet = new Set(propertyIds);
        const byProperty = new Map();
        for (const image of Array.from(this.images.values()).sort((a, b) => a.sortOrder - b.sortOrder)) {
            if (image.deletedAt || !idSet.has(image.propertyId))
                continue;
            const current = byProperty.get(image.propertyId);
            // Mirror SELECT DISTINCT ON (property_id) ... ORDER BY is_primary DESC, sort_order ASC:
            // prefer the primary image, otherwise the lowest sort_order.
            if (!current || (image.isPrimary && !current.isPrimary)) {
                byProperty.set(image.propertyId, image);
            }
        }
        return Array.from(byProperty.values());
    }
    async countForProperty(propertyId) {
        return Array.from(this.images.values()).filter((img) => img.propertyId === propertyId && !img.deletedAt)
            .length;
    }
    async softDelete(id) {
        const existing = this.images.get(id);
        if (!existing)
            return;
        this.images.set(id, { ...existing, deletedAt: new Date(), isPrimary: false });
    }
    async setPrimary(propertyId, imageId) {
        for (const image of this.images.values()) {
            if (image.propertyId !== propertyId)
                continue;
            this.images.set(image.id, { ...image, isPrimary: image.id === imageId });
        }
    }
}
exports.InMemoryPropertyImageRepository = InMemoryPropertyImageRepository;
