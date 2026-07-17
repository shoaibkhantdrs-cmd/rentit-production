import { IPropertyFeatureRepository } from "@/domain/repositories/IPropertyFeatureRepository";
import { PropertyFeature } from "@/domain/entities/PropertyFeature";
import { newId } from "./ids";

export class InMemoryPropertyFeatureRepository implements IPropertyFeatureRepository {
  public readonly byPropertyId = new Map<string, PropertyFeature[]>();

  async listForProperty(propertyId: string): Promise<PropertyFeature[]> {
    return this.byPropertyId.get(propertyId) ?? [];
  }

  async listForProperties(propertyIds: string[]): Promise<PropertyFeature[]> {
    const idSet = new Set(propertyIds);
    const out: PropertyFeature[] = [];
    for (const [propertyId, features] of this.byPropertyId.entries()) {
      if (idSet.has(propertyId)) out.push(...features);
    }
    return out;
  }

  async setForProperty(propertyId: string, featureKeys: string[]): Promise<void> {
    const now = new Date();
    const features: PropertyFeature[] = featureKeys.map((key) => ({
      id: newId(),
      propertyId,
      featureKey: key,
      createdAt: now,
    }));
    this.byPropertyId.set(propertyId, features);
  }
}
