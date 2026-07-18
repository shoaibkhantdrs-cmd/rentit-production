"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyCategoryRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyCategoryRepository {
    categories = new Map();
    /** Test helper -- the real table is migration-seeded, so tests seed it explicitly. */
    seed(name, slug, description = null) {
        const now = new Date();
        const category = {
            id: (0, ids_1.newId)(),
            name,
            slug,
            description,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        };
        this.categories.set(category.id, category);
        return category;
    }
    async findById(id) {
        const category = this.categories.get(id);
        return category && !category.deletedAt ? category : null;
    }
    async findBySlug(slug) {
        for (const category of this.categories.values()) {
            if (category.slug === slug && !category.deletedAt)
                return category;
        }
        return null;
    }
    async findAll() {
        return Array.from(this.categories.values()).filter((c) => !c.deletedAt);
    }
}
exports.InMemoryPropertyCategoryRepository = InMemoryPropertyCategoryRepository;
