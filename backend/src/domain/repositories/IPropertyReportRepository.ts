import { PropertyReport, PropertyReportReason, PropertyReportStatus } from "@/domain/entities/PropertyReport";

export interface NewPropertyReportInput {
  propertyId: string;
  reporterUserId: string;
  reason: PropertyReportReason;
  details?: string | null;
}

export interface PropertyReportListFilters {
  status?: PropertyReportStatus;
}

export interface IPropertyReportRepository {
  create(input: NewPropertyReportInput): Promise<PropertyReport>;
  existsForUserAndProperty(propertyId: string, userId: string): Promise<boolean>;
  /** Phase 4 Part 4 (Report Management) additions -- additive to the Phase 3 interface. */
  findById(id: string): Promise<PropertyReport | null>;
  list(
    filters: PropertyReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: PropertyReport[]; total: number }>;
  updateStatus(id: string, status: PropertyReportStatus, reviewedBy: string): Promise<PropertyReport>;
  countByStatus(status: PropertyReportStatus): Promise<number>;
}
