import { httpClient } from "./httpClient";
import { SavedSearch, SavedSearchFilters } from "./types";

export const savedSearchesApi = {
  list: () => httpClient.get<{ items: SavedSearch[] }>("/saved-searches"),

  create: (name: string, filters: SavedSearchFilters, notifyOnMatch = true) =>
    httpClient.post<SavedSearch>("/saved-searches", { name, filters, notifyOnMatch }),

  update: (id: string, patch: Partial<{ name: string; filters: SavedSearchFilters; notifyOnMatch: boolean }>) =>
    httpClient.patch<SavedSearch>(`/saved-searches/${id}`, patch),

  remove: (id: string) => httpClient.delete<void>(`/saved-searches/${id}`),
};
