export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string;
  createdAt: Date;
}

export interface AuditLogSearchFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IAuditLogRepository {
  record(entry: AuditLogEntry): Promise<void>;
  /** Phase 4 Part 8 (Audit Logs: search + export) -- additive to the Phase 2 interface. */
  search(
    filters: AuditLogSearchFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: AuditLogRecord[]; total: number }>;
}
