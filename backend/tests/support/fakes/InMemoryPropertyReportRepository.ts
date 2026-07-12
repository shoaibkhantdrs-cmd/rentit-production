import {
  IPropertyReportRepository,
  NewPropertyReportInput,
  PropertyReportListFilters,
} from "@/domain/repositories/IPropertyReportRepository";
import { PropertyReport, PropertyReportStatus } from "@/domain/entities/PropertyReport";
import { newId } from "./ids";

export class InMemoryPropertyReportRepository implements IPropertyReportRepository {
  public readonly reports: PropertyReport[] = [];

  async create(input: NewPropertyReportInput): Promise<PropertyReport> {
    const now = new Date();
    const report: PropertyReport = {
      id: newId(),
      propertyId: input.propertyId,
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

  async existsForUserAndProperty(propertyId: string, userId: string): Promise<boolean> {
    return this.reports.some((r) => r.propertyId === propertyId && r.reporterUserId === userId);
  }

  async findById(id: string): Promise<PropertyReport | null> {
    return this.reports.find((r) => r.id === id) ?? null;
  }

  async list(
    filters: PropertyReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: PropertyReport[]; total: number }> {
    let all = this.reports.slice();
    if (filters.status) all = all.filter((r) => r.status === filters.status);
    all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }

  async updateStatus(id: string, status: PropertyReportStatus, reviewedBy: string): Promise<PropertyReport> {
    const existing = this.reports.find((r) => r.id === id);
    if (!existing) throw new Error(`Property report ${id} not found`);
    existing.status = status;
    existing.reviewedBy = reviewedBy;
    existing.reviewedAt = new Date();
    existing.updatedAt = new Date();
    return existing;
  }

  async countByStatus(status: PropertyReportStatus): Promise<number> {
    return this.reports.filter((r) => r.status === status).length;
  }
}
