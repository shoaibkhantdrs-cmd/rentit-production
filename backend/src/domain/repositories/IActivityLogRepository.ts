export interface ActivityLogEntry {
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ActivityLogRecord extends ActivityLogEntry {
  id: string;
  createdAt: Date;
}

export interface IActivityLogRepository {
  record(entry: ActivityLogEntry): Promise<void>;
  /** Phase 4 Part 2 "View User Activity" -- additive to the Phase 2 interface. */
  listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ActivityLogRecord[]; total: number }>;
}
