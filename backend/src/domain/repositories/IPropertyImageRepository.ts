import { PropertyImage } from "@/domain/entities/PropertyImage";

export interface NewPropertyImageInput {
  propertyId: string;
  cloudinaryPublicId: string;
  url: string;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface IPropertyImageRepository {
  create(input: NewPropertyImageInput): Promise<PropertyImage>;
  findById(id: string): Promise<PropertyImage | null>;
  listForProperty(propertyId: string): Promise<PropertyImage[]>;
  /**
   * Every (non-deleted) image for a batch of properties in one query,
   * ordered the same way listForProperty orders a single property's images
   * (sort_order). Additive -- lets PropertyDetailLoader.loadMany batch the
   * full image set for a page of properties instead of one query per row.
   */
  listForProperties(propertyIds: string[]): Promise<PropertyImage[]>;
  /** One (the primary, or otherwise lowest sort_order) image per property -- for list/search thumbnails. */
  listPrimaryForProperties(propertyIds: string[]): Promise<PropertyImage[]>;
  countForProperty(propertyId: string): Promise<number>;
  softDelete(id: string): Promise<void>;
  /** Clears is_primary on every other image for the property, then marks this one primary. */
  setPrimary(propertyId: string, imageId: string): Promise<void>;
}
