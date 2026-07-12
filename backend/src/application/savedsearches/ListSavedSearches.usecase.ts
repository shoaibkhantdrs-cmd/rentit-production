import { ISavedSearchRepository } from "@/domain/repositories/ISavedSearchRepository";

export class ListSavedSearchesUseCase {
  constructor(private readonly savedSearchRepo: ISavedSearchRepository) {}

  async execute(userId: string) {
    return this.savedSearchRepo.listForUser(userId);
  }
}
