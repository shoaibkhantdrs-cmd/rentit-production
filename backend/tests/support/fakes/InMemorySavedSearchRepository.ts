import {
  ISavedSearchRepository,
  NewSavedSearchInput,
  SavedSearchUpdatePatch,
} from "@/domain/repositories/ISavedSearchRepository";
import { SavedSearch } from "@/domain/entities/SavedSearch";
import { newId } from "./ids";

export class InMemorySavedSearchRepository implements ISavedSearchRepository {
  public readonly searches = new Map<string, SavedSearch>();

  async create(input: NewSavedSearchInput): Promise<SavedSearch> {
    const now = new Date();
    const search: SavedSearch = {
      id: newId(),
      userId: input.userId,
      name: input.name,
      filters: input.filters,
      notifyOnMatch: input.notifyOnMatch,
      lastNotifiedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.searches.set(search.id, search);
    return search;
  }

  async findById(id: string): Promise<SavedSearch | null> {
    const search = this.searches.get(id);
    return search && !search.deletedAt ? search : null;
  }

  async listForUser(userId: string): Promise<SavedSearch[]> {
    return [...this.searches.values()]
      .filter((s) => s.userId === userId && !s.deletedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, patch: SavedSearchUpdatePatch): Promise<SavedSearch> {
    const existing = this.searches.get(id);
    if (!existing) throw new Error(`Saved search ${id} not found`);
    const updated: SavedSearch = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.filters !== undefined ? { filters: patch.filters } : {}),
      ...(patch.notifyOnMatch !== undefined ? { notifyOnMatch: patch.notifyOnMatch } : {}),
      ...(patch.lastNotifiedAt !== undefined ? { lastNotifiedAt: patch.lastNotifiedAt } : {}),
      updatedAt: new Date(),
    };
    this.searches.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.searches.get(id);
    if (existing) existing.deletedAt = new Date();
  }

  async listAllNotifiable(): Promise<SavedSearch[]> {
    return [...this.searches.values()].filter((s) => s.notifyOnMatch && !s.deletedAt);
  }
}
