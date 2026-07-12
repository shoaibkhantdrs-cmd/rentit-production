import { ISavedSearchRepository } from "@/domain/repositories/ISavedSearchRepository";
import { SavedSearchFilters } from "@/domain/entities/SavedSearch";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface UpdateSavedSearchInput {
  savedSearchId: string;
  requesterId: string;
  name?: string;
  filters?: SavedSearchFilters;
  notifyOnMatch?: boolean;
}

export class UpdateSavedSearchUseCase {
  constructor(private readonly savedSearchRepo: ISavedSearchRepository) {}

  async execute(input: UpdateSavedSearchInput) {
    const existing = await this.savedSearchRepo.findById(input.savedSearchId);
    if (!existing) throw new NotFoundError("Saved search not found");
    if (existing.userId !== input.requesterId) {
      throw new ForbiddenError("This saved search does not belong to you");
    }

    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new ValidationError("Give this saved search a name");
    }

    return this.savedSearchRepo.update(input.savedSearchId, {
      name,
      filters: input.filters,
      notifyOnMatch: input.notifyOnMatch,
    });
  }
}
