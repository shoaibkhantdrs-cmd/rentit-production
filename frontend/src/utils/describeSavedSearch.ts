import { SavedSearchFilters } from "@/api/types";

/** Renders a SavedSearchFilters object as a single human-readable summary
 * line, e.g. "apartment · Pune · Rs 10,000-20,000/mo · 2+ bed" -- used
 * anywhere we list saved searches instead of showing the raw filter JSON. */
export function describeSavedSearchFilters(filters: SavedSearchFilters): string {
  const parts: string[] = [];

  if (filters.propertyType) parts.push(filters.propertyType);
  if (filters.city) parts.push([filters.locality, filters.city].filter(Boolean).join(", "));
  if (filters.rentMin !== undefined || filters.rentMax !== undefined) {
    const min = filters.rentMin !== undefined ? `Rs ${filters.rentMin.toLocaleString("en-IN")}` : "Rs 0";
    const max = filters.rentMax !== undefined ? filters.rentMax.toLocaleString("en-IN") : "any";
    parts.push(`${min}-${max}/mo`);
  }
  if (filters.bedroomsMin !== undefined) parts.push(`${filters.bedroomsMin}+ bed`);
  if (filters.furnished) parts.push(filters.furnished.replace("_", " "));
  if (filters.radiusKm !== undefined) parts.push(`within ${filters.radiusKm} km`);

  return parts.length > 0 ? parts.join(" · ") : "Any property";
}
