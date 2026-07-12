import {
  IUserReportRepository,
  NewUserReportInput,
  UserReportListFilters,
} from "@/domain/repositories/IUserReportRepository";
import { UserReport, UserReportStatus } from "@/domain/entities/UserReport";
import { newId } from "./ids";

export class InMemoryUserReportRepository implements IUserReportRepository {
  public readonly reports: UserReport[] = [];

  async create(input: NewUserReportInput): Promise<UserReport> {
    const now = new Date();
    const report: UserReport = {
      id: newId(),
      reportedUserId: input.reportedUserId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details ?? null,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.reports.push(report);
    return report;
  }

  async existsForUserAndReporter(reportedUserId: string, reporterUserId: string): Promise<boolean> {
    return this.reports.some(
      (r) => r.reportedUserId === reportedUserId && r.reporterUserId === reporterUserId,
    );
  }

  async findById(id: string): Promise<UserReport | null> {
    return this.reports.find((r) => r.id === id) ?? null;
  }

  async list(
    filters: UserReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: UserReport[]; total: number }> {
    let all = this.reports.slice();
    if (filters.status) all = all.filter((r) => r.status === filters.status);
    all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }

  async updateStatus(id: string, status: UserReportStatus, reviewedBy: string): Promise<UserReport> {
    const existing = this.reports.find((r) => r.id === id);
    if (!existing) throw new Error(`User report ${id} not found`);
    existing.status = status;
    existing.reviewedBy = reviewedBy;
    existing.reviewedAt = new Date();
    existing.updatedAt = new Date();
    return existing;
  }

  async countByStatus(status: UserReportStatus): Promise<number> {
    return this.reports.filter((r) => r.status === status).length;
  }
}
