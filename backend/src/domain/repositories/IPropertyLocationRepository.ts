import { NewPropertyLocation, PropertyLocation } from "@/domain/entities/PropertyLocation";

export interface IPropertyLocationRepository {
  findByPropertyId(propertyId: string): Promise<PropertyLocation | null>;
  findByPropertyIds(propertyIds: string[]): Promise<PropertyLocation[]>;
  upsert(input: NewPropertyLocation): Promise<PropertyLocation>;
}
