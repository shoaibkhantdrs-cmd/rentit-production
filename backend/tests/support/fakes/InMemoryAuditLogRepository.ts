import {
  AuditLogEntry,
  AuditLogRecord,
  AuditLogSearchFilters,
  IAuditLogRepository,
} from "@/domain/repositories/IAuditLogRepository";
import { newId } from "./ids";

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  public readonly entries: AuditLogRecord[] = [];

  async record(entry: AuditLogEntry): Promise<void> {
    this.entries.push({ ...entry, id: newId(), createdAt: new Date() });
  }

  async search(
    filters: AuditLogSearchFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    let all = this.entries.slice();
    if (filters.userId) all = all.filter((e) => e.userId === filters.userId);
    if (filters.action) all = all.filter((e) => e.action === filters.action);
    if (filters.entityType) all = all.filter((e) => e.entityType === filters.entityType);
    if (filters.entityId) all = all.filter((e) => e.entityId === filters.entityId);
    if (filters.dateFrom) all = all.filter((e) => e.createdAt >= filters.dateFrom!);
    if (filters.dateTo) all = all.filter((e) => e.createdAt <= filters.dateTo!);

    all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }
}
