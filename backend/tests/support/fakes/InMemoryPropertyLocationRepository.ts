import {
  IPropertyLocationRepository,
} from "@/domain/repositories/IPropertyLocationRepository";
import { NewPropertyLocation, PropertyLocation } from "@/domain/entities/PropertyLocation";
import { newId } from "./ids";

export class InMemoryPropertyLocationRepository implements IPropertyLocationRepository {
  // Keyed by propertyId -- there is at most one location row per property (1:1).
  public readonly byPropertyId = new Map<string, PropertyLocation>();

  async findByPropertyId(propertyId: string): Promise<PropertyLocation | null> {
    return this.byPropertyId.get(propertyId) ?? null;
  }

  async findByPropertyIds(propertyIds: string[]): Promise<PropertyLocation[]> {
    const idSet = new Set(propertyIds);
    return Array.from(this.byPropertyId.values()).filter((loc) => idSet.has(loc.propertyId));
  }

  async upsert(input: NewPropertyLocation): Promise<PropertyLocation> {
    const existing = this.byPropertyId.get(input.propertyId);
    const now = new Date();
    const location: PropertyLocation = {
      id: existing?.id ?? newId(),
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byPropertyId.set(input.propertyId, location);
    return location;
  }
}
