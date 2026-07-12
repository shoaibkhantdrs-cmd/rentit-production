import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminTestContainer } from "../support/buildAdminTestContainer";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

test("ReportUserUseCase: reports a user, rejects self-report and duplicate report", async () => {
  const container = buildAdminTestContainer();
  const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "reporter@example.com" });
  const target = await container.repos.userRepo.create({ name: "Target", email: "reported@example.com" });

  await assert.rejects(
    () =>
      container.reportUser.execute({
        reportedUserId: reporter.id,
        reporterUserId: reporter.id,
        reason: "spam",
      }),
    ValidationError,
  );

  await container.reportUser.execute({
    reportedUserId: target.id,
    reporterUserId: reporter.id,
    reason: "harassment",
    details: "Sent threatening messages",
  });

  await assert.rejects(
    () =>
      container.reportUser.execute({
        reportedUserId: target.id,
        reporterUserId: reporter.id,
        reason: "spam",
      }),
    ConflictError,
    "reporting the same user twice should conflict",
  );

  assert.equal(container.repos.userReportRepo.reports.length, 1);
});

test("ListUserReportsUseCase / UpdateUserReportStatusUseCase: resolve and dismiss reports", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
  const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "reporter2@example.com" });
  const target = await container.repos.userRepo.create({ name: "Target", email: "reported2@example.com" });

  await container.reportUser.execute({ reportedUserId: target.id, reporterUserId: reporter.id, reason: "fraud" });
  const pending = await container.listUserReports.execute({ status: "pending", page: 1, pageSize: 10 });
  assert.equal(pending.total, 1);

  const reportId = pending.items[0].id;
  const resolved = await container.updateUserReportStatus.execute({
    reportId,
    status: "action_taken",
    actorId: admin.id,
  });
  assert.equal(resolved.status, "action_taken");
  assert.equal(resolved.reviewedBy, admin.id);

  await assert.rejects(
    () =>
      container.updateUserReportStatus.execute({
        reportId: "00000000-0000-0000-0000-000000000000",
        status: "dismissed",
        actorId: admin.id,
      }),
    NotFoundError,
  );
});

test("ListPropertyReportsUseCase / UpdatePropertyReportStatusUseCase: dismiss a property report", async () => {
  const container = buildAdminTestContainer();
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
  assert.equal(list.total, 1);

  const updated = await container.updatePropertyReportStatus.execute({
    reportId: list.items[0].id,
    status: "dismissed",
    actorId: admin.id,
  });
  assert.equal(updated.status, "dismissed");
});

test("Identity verification: submit, list pending, approve sets identityVerifiedAt", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin3@example.com" });
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner2@example.com" });

  const submitted = await container.submitIdentityVerification.execute({
    userId: owner.id,
    documentType: "government_id",
    file: { buffer: Buffer.from("fake-image-bytes") },
  });
  assert.equal(submitted.status, "pending");
  assert.ok(submitted.documentImageUrl);

  const statusBefore = await container.getMyVerificationStatus.execute(owner.id);
  assert.equal(statusBefore.identityVerified, false);
  assert.equal(statusBefore.identityVerification?.id, submitted.id);

  const pendingList = await container.listIdentityVerifications.execute({
    status: "pending",
    page: 1,
    pageSize: 10,
  });
  assert.equal(pendingList.total, 1);

  await container.approveIdentityVerification.execute({ verificationId: submitted.id, actorId: admin.id });

  const statusAfter = await container.getMyVerificationStatus.execute(owner.id);
  assert.equal(statusAfter.identityVerified, true);
});

test("Identity verification: rejection requires a reason and allows resubmission", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin4@example.com" });
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner3@example.com" });

  const submitted = await container.submitIdentityVerification.execute({
    userId: owner.id,
    documentType: "passport",
    file: { buffer: Buffer.from("fake-image-bytes") },
  });

  await assert.rejects(
    () =>
      container.rejectIdentityVerification.execute({
        verificationId: submitted.id,
        actorId: admin.id,
        reason: "  ",
      }),
    ValidationError,
  );

  const rejected = await container.rejectIdentityVerification.execute({
    verificationId: submitted.id,
    actorId: admin.id,
    reason: "Document is blurry",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Document is blurry");

  // Resubmission: latest-for-user should now be the newest submission.
  const resubmitted = await container.submitIdentityVerification.execute({
    userId: owner.id,
    documentType: "passport",
    file: { buffer: Buffer.from("clearer-image-bytes") },
  });
  const status = await container.getMyVerificationStatus.execute(owner.id);
  assert.equal(status.identityVerification?.id, resubmitted.id);
});
