import {
  IdentityDocumentType,
  IdentityVerification,
  IdentityVerificationStatus,
} from "@/domain/entities/IdentityVerification";

export interface NewIdentityVerificationInput {
  userId: string;
  documentType: IdentityDocumentType;
  documentImageUrl: string;
}

export interface IdentityVerificationListFilters {
  status?: IdentityVerificationStatus;
}

export interface IIdentityVerificationRepository {
  create(input: NewIdentityVerificationInput): Promise<IdentityVerification>;
  findById(id: string): Promise<IdentityVerification | null>;
  /** Most recent submission for a user, regardless of status -- "current" verification status. */
  findLatestForUser(userId: string): Promise<IdentityVerification | null>;
  list(
    filters: IdentityVerificationListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: IdentityVerification[]; total: number }>;
  updateStatus(
    id: string,
    status: IdentityVerificationStatus,
    reviewedBy: string,
    rejectionReason?: string | null,
  ): Promise<IdentityVerification>;
  countByStatus(status: IdentityVerificationStatus): Promise<number>;
}
