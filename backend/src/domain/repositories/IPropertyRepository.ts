import { NewProperty, Property, PropertyUpdatePatch } from "@/domain/entities/Property";

export type SortOption =
  | "newest"
  | "most_viewed"
  | "price_low_to_high"
  | "price_high_to_low";

export interface PropertySearchFilters {
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
  /** Only listings available on or before this date pass the filter. */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export interface PropertySearchOptions {
  filters: PropertySearchFilters;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export interface PropertySearchResultItem {
  property: Property;
  distanceKm: number | null;
}

export interface PropertySearchResult {
  items: PropertySearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Phase 4 (Admin/Moderation) addition. Deliberately separate from
 * PropertySearchOptions/search() above: the public search path always
 * hardcodes `status = 'published'` (see buildPropertySearchQuery.ts) and
 * must stay that way for the public API. Admins need to browse *any*
 * status (pending/rejected/inactive/...) and filter by owner or featured
 * flag, which is a different enough query shape to warrant its own type
 * rather than overloading the public one with an "adminMode" flag.
 */
export interface AdminPropertySearchFilters {
  status?: Property["status"];
  categoryId?: string;
  ownerId?: string;
  isFeatured?: boolean;
  city?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export type AdminPropertySort = "newest" | "oldest" | "most_viewed" | "most_favorited";

export interface AdminPropertySearchOptions {
  filters: AdminPropertySearchFilters;
  sort: AdminPropertySort;
  page: number;
  pageSize: number;
}

export interface AdminPropertySearchResult {
  items: Property[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IPropertyRepository {
  create(data: NewProperty): Promise<Property>;
  findById(id: string): Promise<Property | null>;
  update(id: string, patch: PropertyUpdatePatch): Promise<Property>;
  softDelete(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  adjustFavoriteCount(id: string, delta: 1 | -1): Promise<void>;
  search(options: PropertySearchOptions): Promise<PropertySearchResult>;
  findByOwner(
    ownerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Property[]; total: number }>;
  findManyByIds(ids: string[]): Promise<Property[]>;
  /** Admin-only: any status, not just published (see AdminPropertySearchFilters doc above). */
  adminSearch(options: AdminPropertySearchOptions): Promise<AdminPropertySearchResult>;
}
