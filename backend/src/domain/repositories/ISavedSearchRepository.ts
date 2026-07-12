import { SavedSearch, SavedSearchFilters } from "@/domain/entities/SavedSearch";

export interface NewSavedSearchInput {
  userId: string;
  name: string;
  filters: SavedSearchFilters;
  notifyOnMatch: boolean;
}

export interface SavedSearchUpdatePatch {
  name?: string;
  filters?: SavedSearchFilters;
  notifyOnMatch?: boolean;
  lastNotifiedAt?: Date;
}

/**
 * The saved_searches table and SavedSearch entity were created in Phase 3
 * (migration 024) but the repository/use-cases/HTTP layer were never
 * built -- Phase 5 Part 5 ("Saved Searches") is where that feature is
 * actually completed, on top of the schema that already exists.
 */
export interface ISavedSearchRepository {
  create(input: NewSavedSearchInput): Promise<SavedSearch>;
  findById(id: string): Promise<SavedSearch | null>;
  listForUser(userId: string): Promise<SavedSearch[]>;
  update(id: string, patch: SavedSearchUpdatePatch): Promise<SavedSearch>;
  softDelete(id: string): Promise<void>;
  /** All saved searches with notifyOnMatch = true, across every user --
   * the input to the "notify on new matching properties" sweep. */
  listAllNotifiable(): Promise<SavedSearch[]>;
}
