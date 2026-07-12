import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";
import { PropertyCategory } from "@/domain/entities/PropertyCategory";
import { newId } from "./ids";

export class InMemoryPropertyCategoryRepository implements IPropertyCategoryRepository {
  public readonly categories = new Map<string, PropertyCategory>();

  /** Test helper -- the real table is migration-seeded, so tests seed it explicitly. */
  seed(name: string, slug: string, description: string | null = null): PropertyCategory {
    const now = new Date();
    const category: PropertyCategory = {
      id: newId(),
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

  async findById(id: string): Promise<PropertyCategory | null> {
    const category = this.categories.get(id);
    return category && !category.deletedAt ? category : null;
  }

  async findBySlug(slug: string): Promise<PropertyCategory | null> {
    for (const category of this.categories.values()) {
      if (category.slug === slug && !category.deletedAt) return category;
    }
    return null;
  }

  async findAll(): Promise<PropertyCategory[]> {
    return Array.from(this.categories.values()).filter((c) => !c.deletedAt);
  }
}
