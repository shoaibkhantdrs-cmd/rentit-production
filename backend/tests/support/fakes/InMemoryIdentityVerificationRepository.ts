import {
  IIdentityVerificationRepository,
  IdentityVerificationListFilters,
  NewIdentityVerificationInput,
} from "@/domain/repositories/IIdentityVerificationRepository";
import { IdentityVerification, IdentityVerificationStatus } from "@/domain/entities/IdentityVerification";
import { newId } from "./ids";

export class InMemoryIdentityVerificationRepository implements IIdentityVerificationRepository {
  public readonly verifications: IdentityVerification[] = [];

  async create(input: NewIdentityVerificationInput): Promise<IdentityVerification> {
    const now = new Date();
    const verification: IdentityVerification = {
      id: newId(),
      userId: input.userId,
      documentType: input.documentType,
      documentImageUrl: input.documentImageUrl,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.verifications.push(verification);
    return verification;
  }

  async findById(id: string): Promise<IdentityVerification | null> {
    return this.verifications.find((v) => v.id === id) ?? null;
  }

  async findLatestForUser(userId: string): Promise<IdentityVerification | null> {
    const forUser = this.verifications.filter((v) => v.userId === userId);
    if (forUser.length === 0) return null;
    // Reduce left-to-right with `>=` so that on an exact createdAt tie
    // (easily hit in tests, where two submissions can land in the same
    // millisecond), the later-inserted submission wins -- array order is
    // always true insertion order here, a tiebreaker plain createdAt
    // sorting can't express.
    return forUser.reduce((latest, current) =>
      current.createdAt.getTime() >= latest.createdAt.getTime() ? current : latest,
    );
  }

  async list(
    filters: IdentityVerificationListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: IdentityVerification[]; total: number }> {
    let all = this.verifications.slice();
    if (filters.status) all = all.filter((v) => v.status === filters.status);
    all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * pageSize;
    return { items: all.slice(offset, offset + pageSize), total: all.length };
  }

  async updateStatus(
    id: string,
    status: IdentityVerificationStatus,
    reviewedBy: string,
    rejectionReason?: string | null,
  ): Promise<IdentityVerification> {
    const existing = this.verifications.find((v) => v.id === id);
    if (!existing) throw new Error(`Identity verification ${id} not found`);
    existing.status = status;
    existing.reviewedBy = reviewedBy;
    existing.reviewedAt = new Date();
    existing.rejectionReason = rejectionReason ?? null;
    existing.updatedAt = new Date();
    return existing;
  }

  async countByStatus(status: IdentityVerificationStatus): Promise<number> {
    return this.verifications.filter((v) => v.status === status).length;
  }
}
