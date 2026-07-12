import { SavedSearchFilters } from "@/api/types";

/**
 * Turns a saved search's filters back into a /search?... deep link.
 * SavedSearchFilters stores `categoryId` (a stable UUID, needed for
 * accurate matching against new listings server-side in
 * NotifySavedSearchesForPropertyUseCase), while SearchPage's own filter
 * state reads a category *slug* from the query string. Re-resolving the
 * slug would require an extra categories lookup for what's a "jump back
 * to roughly this search" convenience link, so this intentionally omits
 * categoryId from the URL and carries every other filter across as-is.
 */
export function buildSearchLink(filters: SavedSearchFilters): string {
  const params = new URLSearchParams();
  if (filters.propertyType) params.set("propertyType", filters.propertyType);
  if (filters.rentMin !== undefined) params.set("rentMin", String(filters.rentMin));
  if (filters.rentMax !== undefined) params.set("rentMax", String(filters.rentMax));
  if (filters.bedroomsMin !== undefined) params.set("bedroomsMin", String(filters.bedroomsMin));
  if (filters.bathroomsMin !== undefined) params.set("bathroomsMin", String(filters.bathroomsMin));
  if (filters.parkingMin !== undefined) params.set("parkingMin", String(filters.parkingMin));
  if (filters.areaMin !== undefined) params.set("areaMin", String(filters.areaMin));
  if (filters.areaMax !== undefined) params.set("areaMax", String(filters.areaMax));
  if (filters.city) params.set("city", filters.city);
  if (filters.locality) params.set("locality", filters.locality);
  if (filters.furnished) params.set("furnished", filters.furnished);
  if (filters.availableFrom) params.set("availableFrom", filters.availableFrom);
  if (filters.latitude !== undefined) params.set("lat", String(filters.latitude));
  if (filters.longitude !== undefined) params.set("lng", String(filters.longitude));
  if (filters.radiusKm !== undefined) params.set("radiusKm", String(filters.radiusKm));

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}
