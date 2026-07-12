import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";

export interface SearchAuditLogsInput {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

/** "Audit Logs: search" (Part 8). Export (CSV) reuses this same use-case
 * with a larger page size -- CSV formatting is a presentation concern
 * handled in the controller, not here. */
export class SearchAuditLogsUseCase {
  constructor(private readonly auditLogRepo: IAuditLogRepository) {}

  async execute(input: SearchAuditLogsInput) {
    const result = await this.auditLogRepo.search(
      {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
      input.page,
      input.pageSize,
    );
    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
