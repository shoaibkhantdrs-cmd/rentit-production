import {
  IPropertyImageRepository,
  NewPropertyImageInput,
} from "@/domain/repositories/IPropertyImageRepository";
import { PropertyImage } from "@/domain/entities/PropertyImage";
import { newId } from "./ids";

export class InMemoryPropertyImageRepository implements IPropertyImageRepository {
  public readonly images = new Map<string, PropertyImage>();

  async create(input: NewPropertyImageInput): Promise<PropertyImage> {
    const now = new Date();
    const image: PropertyImage = {
      id: newId(),
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

  async findById(id: string): Promise<PropertyImage | null> {
    return this.images.get(id) ?? null;
  }

  async listForProperty(propertyId: string): Promise<PropertyImage[]> {
    return Array.from(this.images.values())
      .filter((img) => img.propertyId === propertyId && !img.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listForProperties(propertyIds: string[]): Promise<PropertyImage[]> {
    const idSet = new Set(propertyIds);
    return Array.from(this.images.values())
      .filter((img) => idSet.has(img.propertyId) && !img.deletedAt)
      .sort((a, b) => a.propertyId.localeCompare(b.propertyId) || a.sortOrder - b.sortOrder);
  }

  async listPrimaryForProperties(propertyIds: string[]): Promise<PropertyImage[]> {
    const idSet = new Set(propertyIds);
    const byProperty = new Map<string, PropertyImage>();

    for (const image of Array.from(this.images.values()).sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (image.deletedAt || !idSet.has(image.propertyId)) continue;
      const current = byProperty.get(image.propertyId);
      // Mirror SELECT DISTINCT ON (property_id) ... ORDER BY is_primary DESC, sort_order ASC:
      // prefer the primary image, otherwise the lowest sort_order.
      if (!current || (image.isPrimary && !current.isPrimary)) {
        byProperty.set(image.propertyId, image);
      }
    }

    return Array.from(byProperty.values());
  }

  async countForProperty(propertyId: string): Promise<number> {
    return Array.from(this.images.values()).filter((img) => img.propertyId === propertyId && !img.deletedAt)
      .length;
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.images.get(id);
    if (!existing) return;
    this.images.set(id, { ...existing, deletedAt: new Date(), isPrimary: false });
  }

  async setPrimary(propertyId: string, imageId: string): Promise<void> {
    for (const image of this.images.values()) {
      if (image.propertyId !== propertyId) continue;
      this.images.set(image.id, { ...image, isPrimary: image.id === imageId });
    }
  }
}
