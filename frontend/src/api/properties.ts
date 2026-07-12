import { httpClient } from "./httpClient";
import {
  CreatePropertyPayload,
  PaginatedResult,
  PropertyCategory,
  PropertyDetail,
  PropertySummary,
  SearchFilters,
  UpdatePropertyPayload,
} from "./types";

export const propertiesApi = {
  // Category list changes essentially never -- cache it for 5 minutes so
  // navigating between Home/Search/Add-property doesn't re-fetch it
  // every time (Phase 5 Part 8: caching).
  categories: () =>
    httpClient.get<{ items: PropertyCategory[] }>("/properties/categories", undefined, false, 5 * 60 * 1000),

  search: (filters: SearchFilters) =>
    httpClient.get<PaginatedResult<PropertySummary>>(
      "/properties",
      {
        category: filters.category,
        propertyType: filters.propertyType,
        rentMin: filters.rentMin,
        rentMax: filters.rentMax,
        bedroomsMin: filters.bedroomsMin,
        bathroomsMin: filters.bathroomsMin,
        parkingMin: filters.parkingMin,
        areaMin: filters.areaMin,
        areaMax: filters.areaMax,
        city: filters.city,
        locality: filters.locality,
        furnished: filters.furnished,
        availableFrom: filters.availableFrom,
        lat: filters.lat,
        lng: filters.lng,
        radiusKm: filters.radiusKm,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      },
      false,
    ),

  // optionalAuthenticate on the backend: attach the token when we have one
  // (so isFavorited / draft-preview-for-owner work), but never force login.
  getById: (id: string) => httpClient.get<PropertyDetail>(`/properties/${id}`, undefined, true),

  create: (payload: CreatePropertyPayload) => httpClient.post<PropertyDetail>("/properties", payload),

  update: (id: string, payload: UpdatePropertyPayload) =>
    httpClient.patch<PropertyDetail>(`/properties/${id}`, payload),

  remove: (id: string) => httpClient.delete<void>(`/properties/${id}`),

  uploadImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    return httpClient.postForm<
      Array<{ id: string; url: string; isPrimary: boolean; sortOrder: number }>
    >(`/properties/${id}/images`, form);
  },

  deleteImage: (id: string, imageId: string) => httpClient.delete<void>(`/properties/${id}/images/${imageId}`),

  favorite: (id: string) => httpClient.post<{ favorited: boolean }>(`/properties/${id}/favorite`),

  unfavorite: (id: string) => httpClient.delete<{ favorited: boolean }>(`/properties/${id}/favorite`),

  report: (id: string, reason: string, details?: string) =>
    httpClient.post<{ message: string }>(`/properties/${id}/report`, { reason, details }),

  mine: (page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<PropertyDetail>>("/properties/mine", { page, pageSize }),

  favorites: (page: number, pageSize: number) =>
    httpClient.get<PaginatedResult<PropertyDetail>>("/properties/favorites", { page, pageSize }),

  // Phase 5 Parts 6-7.
  recentlyViewed: () => httpClient.get<{ items: PropertyDetail[] }>("/properties/recently-viewed"),

  recommendationsForMe: (limit = 8) =>
    httpClient.get<{ items: PropertyDetail[] }>("/properties/recommendations", { limit }),

  recommendationsForProperty: (id: string, limit = 8) =>
    httpClient.get<{ items: PropertyDetail[] }>(`/properties/${id}/recommendations`, { limit }, false),
};
