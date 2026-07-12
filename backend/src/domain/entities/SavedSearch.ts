export interface SavedSearchFilters {
  categoryId?: string;
  propertyType?: string;
  rentMin?: number;
  rentMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  parkingMin?: number;
  areaMin?: number;
  areaMax?: number;
  city?: string;
  locality?: string;
  furnished?: string;
  availableFrom?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SavedSearchFilters;
  notifyOnMatch: boolean;
  lastNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
