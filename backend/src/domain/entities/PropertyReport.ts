export type PropertyReportReason =
  | "spam"
  | "fraud"
  | "incorrect_information"
  | "duplicate_listing"
  | "offensive_content"
  | "already_rented"
  | "other";

export type PropertyReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

export interface PropertyReport {
  id: string;
  propertyId: string;
  reporterUserId: string;
  reason: PropertyReportReason;
  details: string | null;
  status: PropertyReportStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
