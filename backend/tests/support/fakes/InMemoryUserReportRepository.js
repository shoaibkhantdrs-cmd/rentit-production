"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUserReportRepository = void 0;
const ids_1 = require("./ids");
class InMemoryUserReportRepository {
    reports = [];
    async create(input) {
        const now = new Date();
        const report = {
            id: (0, ids_1.newId)(),
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
    async existsForUserAndReporter(reportedUserId, reporterUserId) {
        return this.reports.some((r) => r.reportedUserId === reportedUserId && r.reporterUserId === reporterUserId);
    }
    async findById(id) {
        return this.reports.find((r) => r.id === id) ?? null;
    }
    async list(filters, page, pageSize) {
        let all = this.reports.slice();
        if (filters.status)
            all = all.filter((r) => r.status === filters.status);
        all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const offset = (page - 1) * pageSize;
        return { items: all.slice(offset, offset + pageSize), total: all.length };
    }
    async updateStatus(id, status, reviewedBy) {
        const existing = this.reports.find((r) => r.id === id);
        if (!existing)
            throw new Error(`User report ${id} not found`);
        existing.status = status;
        existing.reviewedBy = reviewedBy;
        existing.reviewedAt = new Date();
        existing.updatedAt = new Date();
        return existing;
    }
    async countByStatus(status) {
        return this.reports.filter((r) => r.status === status).length;
    }
}
exports.InMemoryUserReportRepository = InMemoryUserReportRepository;
