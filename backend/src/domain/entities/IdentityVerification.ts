export type IdentityDocumentType = "government_id" | "passport" | "driving_license" | "other";
export type IdentityVerificationStatus = "pending" | "approved" | "rejected";

export interface IdentityVerification {
  id: string;
  userId: string;
  documentType: IdentityDocumentType;
  documentImageUrl: string;
  status: IdentityVerificationStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
