import { Property } from "@/domain/entities/Property";
import { PropertyLocation } from "@/domain/entities/PropertyLocation";
import { SavedSearchFilters } from "@/domain/entities/SavedSearch";
import { haversineDistanceKm } from "./haversine";

/**
 * Phase 5 Part 5 ("notify when new matching properties appear"). A pure,
 * in-memory equivalent of what buildPropertySearchQuery.ts does in SQL --
 * reimplemented as a function over a single already-loaded Property
 * (+ its location) rather than issuing a query, because the saved-search
 * sweep runs "does this one newly-published property match this saved
 * search's filters" for potentially many saved searches against the same
 * property, and a plain in-memory check is simpler than round-tripping to
 * Postgres once per saved search.
 */
export function matchesSavedSearch(
  property: Property,
  location: PropertyLocation | null,
  filters: SavedSearchFilters,
): boolean {
  if (filters.categoryId && property.categoryId !== filters.categoryId) return false;
  if (filters.propertyType && property.propertyType !== filters.propertyType) return false;
  if (filters.rentMin !== undefined && property.rentAmount < filters.rentMin) return false;
  if (filters.rentMax !== undefined && property.rentAmount > filters.rentMax) return false;
  if (filters.bedroomsMin !== undefined && property.bedrooms < filters.bedroomsMin) return false;
  if (filters.bathroomsMin !== undefined && property.bathrooms < filters.bathroomsMin) return false;
  if (filters.parkingMin !== undefined && property.parkingSpaces < filters.parkingMin) return false;
  if (filters.areaMin !== undefined && property.areaSqft < filters.areaMin) return false;
  if (filters.areaMax !== undefined && property.areaSqft > filters.areaMax) return false;
  if (filters.furnished && property.furnishedStatus !== filters.furnished) return false;
  if (filters.availableFrom && property.availableFrom > filters.availableFrom) return false;

  if (filters.city && location?.city.toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.locality && location?.locality?.toLowerCase() !== filters.locality.toLowerCase()) {
    return false;
  }

  if (filters.latitude !== undefined && filters.longitude !== undefined && filters.radiusKm !== undefined) {
    if (!location) return false;
    const distance = haversineDistanceKm(
      filters.latitude,
      filters.longitude,
      location.latitude,
      location.longitude,
    );
    if (distance > filters.radiusKm) return false;
  }

  return true;
}
