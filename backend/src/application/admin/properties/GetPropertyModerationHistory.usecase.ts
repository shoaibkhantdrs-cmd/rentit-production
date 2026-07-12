import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";

export interface GetPropertyModerationHistoryInput {
  propertyId?: string; // omit for the admin-wide recent-activity feed
  page: number;
  pageSize: number;
}

/** "Moderation History" (Part 3) -- reuses Phase 3's property_status_history
 * table directly; every approve/reject/hide/unhide/status-change already
 * writes a row there via IPropertyStatusHistoryRepository.record(). */
export class GetPropertyModerationHistoryUseCase {
  constructor(private readonly statusHistoryRepo: IPropertyStatusHistoryRepository) {}

  async execute(input: GetPropertyModerationHistoryInput) {
    const result = input.propertyId
      ? await this.statusHistoryRepo.listForProperty(input.propertyId, input.page, input.pageSize)
      : await this.statusHistoryRepo.listRecent(input.page, input.pageSize);

    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
