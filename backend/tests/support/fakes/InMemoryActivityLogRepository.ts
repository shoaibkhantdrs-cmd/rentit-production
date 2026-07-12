import {
  ActivityLogEntry,
  ActivityLogRecord,
  IActivityLogRepository,
} from "@/domain/repositories/IActivityLogRepository";
import { newId } from "./ids";

export class InMemoryActivityLogRepository implements IActivityLogRepository {
  public readonly entries: ActivityLogRecord[] = [];

  async record(entry: ActivityLogEntry): Promise<void> {
    this.entries.push({ ...entry, id: newId(), createdAt: new Date() });
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ActivityLogRecord[]; total: number }> {
    const all = this.entries
      .filter((e) => e.userId === userId)
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }
}
