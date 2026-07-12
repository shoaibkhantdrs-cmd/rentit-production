import { PropertyFeature } from "@/domain/entities/PropertyFeature";

export interface IPropertyFeatureRepository {
  listForProperty(propertyId: string): Promise<PropertyFeature[]>;
  /** Replaces the full feature set for a property in one call. */
  setForProperty(propertyId: string, featureKeys: string[]): Promise<void>;
}
