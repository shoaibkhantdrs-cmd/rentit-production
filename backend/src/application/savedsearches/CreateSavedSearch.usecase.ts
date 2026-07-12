import { ISavedSearchRepository } from "@/domain/repositories/ISavedSearchRepository";
import { SavedSearchFilters } from "@/domain/entities/SavedSearch";
import { ValidationError } from "@/domain/errors/AppError";

export interface CreateSavedSearchInput {
  userId: string;
  name: string;
  filters: SavedSearchFilters;
  notifyOnMatch: boolean;
}

export class CreateSavedSearchUseCase {
  constructor(private readonly savedSearchRepo: ISavedSearchRepository) {}

  async execute(input: CreateSavedSearchInput) {
    const name = input.name.trim();
    if (!name) {
      throw new ValidationError("Give this saved search a name");
    }

    return this.savedSearchRepo.create({
      userId: input.userId,
      name,
      filters: input.filters,
      notifyOnMatch: input.notifyOnMatch,
    });
  }
}
