export type UserReportReason =
  | "spam"
  | "harassment"
  | "fraud"
  | "fake_profile"
  | "inappropriate_behavior"
  | "other";

export type UserReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

export interface UserReport {
  id: string;
  reportedUserId: string;
  reporterUserId: string;
  reason: UserReportReason;
  details: string | null;
  status: UserReportStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
