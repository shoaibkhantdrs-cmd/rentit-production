import { PropertyStatus } from "@/domain/entities/Property";

export interface RecordPropertyStatusChangeInput {
  propertyId: string;
  previousStatus: PropertyStatus | null;
  newStatus: PropertyStatus;
  changedBy: string | null;
  reason?: string | null;
}

export interface PropertyStatusHistoryRecord {
  id: string;
  propertyId: string;
  previousStatus: PropertyStatus | null;
  newStatus: PropertyStatus;
  changedBy: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface IPropertyStatusHistoryRepository {
  record(input: RecordPropertyStatusChangeInput): Promise<void>;
  /** Phase 4 Part 3 "Moderation History" -- reuses this Phase 3 table directly. */
  listForProperty(propertyId: string, page: number, pageSize: number): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }>;
  /** Admin-wide recent-activity feed for the moderation dashboard. */
  listRecent(page: number, pageSize: number): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }>;
}
