import { UserReport, UserReportReason, UserReportStatus } from "@/domain/entities/UserReport";

export interface NewUserReportInput {
  reportedUserId: string;
  reporterUserId: string;
  reason: UserReportReason;
  details?: string | null;
}

export interface UserReportListFilters {
  status?: UserReportStatus;
}

/** Structural mirror of IPropertyReportRepository -- see that file's doc comment. */
export interface IUserReportRepository {
  create(input: NewUserReportInput): Promise<UserReport>;
  existsForUserAndReporter(reportedUserId: string, reporterUserId: string): Promise<boolean>;
  findById(id: string): Promise<UserReport | null>;
  list(
    filters: UserReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: UserReport[]; total: number }>;
  updateStatus(id: string, status: UserReportStatus, reviewedBy: string): Promise<UserReport>;
  countByStatus(status: UserReportStatus): Promise<number>;
}
