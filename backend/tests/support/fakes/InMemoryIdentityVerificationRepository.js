"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryIdentityVerificationRepository = void 0;
const ids_1 = require("./ids");
class InMemoryIdentityVerificationRepository {
    verifications = [];
    async create(input) {
        const now = new Date();
        const verification = {
            id: (0, ids_1.newId)(),
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
    async findById(id) {
        return this.verifications.find((v) => v.id === id) ?? null;
    }
    async findLatestForUser(userId) {
        const forUser = this.verifications.filter((v) => v.userId === userId);
        if (forUser.length === 0)
            return null;
        // Reduce left-to-right with `>=` so that on an exact createdAt tie
        // (easily hit in tests, where two submissions can land in the same
        // millisecond), the later-inserted submission wins -- array order is
        // always true insertion order here, a tiebreaker plain createdAt
        // sorting can't express.
        return forUser.reduce((latest, current) => current.createdAt.getTime() >= latest.createdAt.getTime() ? current : latest);
    }
    async list(filters, page, pageSize) {
        let all = this.verifications.slice();
        if (filters.status)
            all = all.filter((v) => v.status === filters.status);
        all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
    async updateStatus(id, status, reviewedBy, rejectionReason) {
        const existing = this.verifications.find((v) => v.id === id);
        if (!existing)
            throw new Error(`Identity verification ${id} not found`);
        existing.status = status;
        existing.reviewedBy = reviewedBy;
        existing.reviewedAt = new Date();
        existing.rejectionReason = rejectionReason ?? null;
        existing.updatedAt = new Date();
        return existing;
    }
    async countByStatus(status) {
        return this.verifications.filter((v) => v.status === status).length;
    }
}
exports.InMemoryIdentityVerificationRepository = InMemoryIdentityVerificationRepository;
