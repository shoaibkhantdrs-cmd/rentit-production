import {
  IPropertyStatusHistoryRepository,
  PropertyStatusHistoryRecord,
  RecordPropertyStatusChangeInput,
} from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { newId } from "./ids";

export class InMemoryPropertyStatusHistoryRepository implements IPropertyStatusHistoryRepository {
  public readonly entries: PropertyStatusHistoryRecord[] = [];

  async record(input: RecordPropertyStatusChangeInput): Promise<void> {
    this.entries.push({
      id: newId(),
      propertyId: input.propertyId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      changedBy: input.changedBy,
      reason: input.reason ?? null,
      createdAt: new Date(),
    });
  }

  async listForProperty(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }> {
    const all = this.entries
      .filter((e) => e.propertyId === propertyId)
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }

  async listRecent(page: number, pageSize: number): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }> {
    const all = this.entries.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }
}
