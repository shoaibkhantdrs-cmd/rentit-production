"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildAdminTestContainer_1 = require("../support/buildAdminTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
(0, node_test_1.test)("ReportUserUseCase: reports a user, rejects self-report and duplicate report", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "reporter@example.com" });
    const target = await container.repos.userRepo.create({ name: "Target", email: "reported@example.com" });
    await strict_1.default.rejects(() => container.reportUser.execute({
        reportedUserId: reporter.id,
        reporterUserId: reporter.id,
        reason: "spam",
    }), AppError_1.ValidationError);
    await container.reportUser.execute({
        reportedUserId: target.id,
        reporterUserId: reporter.id,
        reason: "harassment",
        details: "Sent threatening messages",
    });
    await strict_1.default.rejects(() => container.reportUser.execute({
        reportedUserId: target.id,
        reporterUserId: reporter.id,
        reason: "spam",
    }), AppError_1.ConflictError, "reporting the same user twice should conflict");
    strict_1.default.equal(container.repos.userReportRepo.reports.length, 1);
});
(0, node_test_1.test)("ListUserReportsUseCase / UpdateUserReportStatusUseCase: resolve and dismiss reports", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
    const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "reporter2@example.com" });
    const target = await container.repos.userRepo.create({ name: "Target", email: "reported2@example.com" });
    await container.reportUser.execute({ reportedUserId: target.id, reporterUserId: reporter.id, reason: "fraud" });
    const pending = await container.listUserReports.execute({ status: "pending", page: 1, pageSize: 10 });
    strict_1.default.equal(pending.total, 1);
    const reportId = pending.items[0].id;
    const resolved = await container.updateUserReportStatus.execute({
        reportId,
        status: "action_taken",
        actorId: admin.id,
    });
    strict_1.default.equal(resolved.status, "action_taken");
    strict_1.default.equal(resolved.reviewedBy, admin.id);
    await strict_1.default.rejects(() => container.updateUserReportStatus.execute({
        reportId: "00000000-0000-0000-0000-000000000000",
        status: "dismissed",
        actorId: admin.id,
    }), AppError_1.NotFoundError);
});
(0, node_test_1.test)("ListPropertyReportsUseCase / UpdatePropertyReportStatusUseCase: dismiss a property report", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin2@example.com" });
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
    const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "reporter3@example.com" });
    const property = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: "00000000-0000-0000-0000-000000000001",
        title: "Reported Listing",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 15000,
        securityDeposit: 30000,
        areaSqft: 600,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    await container.repos.propertyReportRepo.create({
        propertyId: property.id,
        reporterUserId: reporter.id,
        reason: "spam",
    });
    const list = await container.listPropertyReports.execute({ status: "pending", page: 1, pageSize: 10 });
    strict_1.default.equal(list.total, 1);
    const updated = await container.updatePropertyReportStatus.execute({
        reportId: list.items[0].id,
        status: "dismissed",
        actorId: admin.id,
    });
    strict_1.default.equal(updated.status, "dismissed");
});
(0, node_test_1.test)("Identity verification: submit, list pending, approve sets identityVerifiedAt", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin3@example.com" });
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner2@example.com" });
    const submitted = await container.submitIdentityVerification.execute({
        userId: owner.id,
        documentType: "government_id",
        file: { buffer: Buffer.from("fake-image-bytes") },
    });
    strict_1.default.equal(submitted.status, "pending");
    strict_1.default.ok(submitted.documentImageUrl);
    const statusBefore = await container.getMyVerificationStatus.execute(owner.id);
    strict_1.default.equal(statusBefore.identityVerified, false);
    strict_1.default.equal(statusBefore.identityVerification?.id, submitted.id);
    const pendingList = await container.listIdentityVerifications.execute({
        status: "pending",
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(pendingList.total, 1);
    await container.approveIdentityVerification.execute({ verificationId: submitted.id, actorId: admin.id });
    const statusAfter = await container.getMyVerificationStatus.execute(owner.id);
    strict_1.default.equal(statusAfter.identityVerified, true);
});
(0, node_test_1.test)("Identity verification: rejection requires a reason and allows resubmission", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin4@example.com" });
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner3@example.com" });
    const submitted = await container.submitIdentityVerification.execute({
        userId: owner.id,
        documentType: "passport",
        file: { buffer: Buffer.from("fake-image-bytes") },
    });
    await strict_1.default.rejects(() => container.rejectIdentityVerification.execute({
        verificationId: submitted.id,
        actorId: admin.id,
        reason: "  ",
    }), AppError_1.ValidationError);
    const rejected = await container.rejectIdentityVerification.execute({
        verificationId: submitted.id,
        actorId: admin.id,
        reason: "Document is blurry",
    });
    strict_1.default.equal(rejected.status, "rejected");
    strict_1.default.equal(rejected.rejectionReason, "Document is blurry");
    // Resubmission: latest-for-user should now be the newest submission.
    const resubmitted = await container.submitIdentityVerification.execute({
        userId: owner.id,
        documentType: "passport",
        file: { buffer: Buffer.from("clearer-image-bytes") },
    });
    const status = await container.getMyVerificationStatus.execute(owner.id);
    strict_1.default.equal(status.identityVerification?.id, resubmitted.id);
});
