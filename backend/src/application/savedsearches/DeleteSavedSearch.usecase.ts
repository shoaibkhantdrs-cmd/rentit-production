import { ISavedSearchRepository } from "@/domain/repositories/ISavedSearchRepository";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";

export interface DeleteSavedSearchInput {
  savedSearchId: string;
  requesterId: string;
}

export class DeleteSavedSearchUseCase {
  constructor(private readonly savedSearchRepo: ISavedSearchRepository) {}

  async execute(input: DeleteSavedSearchInput): Promise<void> {
    const existing = await this.savedSearchRepo.findById(input.savedSearchId);
    if (!existing) throw new NotFoundError("Saved search not found");
    if (existing.userId !== input.requesterId) {
      throw new ForbiddenError("This saved search does not belong to you");
    }
    await this.savedSearchRepo.softDelete(input.savedSearchId);
  }
}
