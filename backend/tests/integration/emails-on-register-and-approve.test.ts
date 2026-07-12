import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTestContainer, TEST_DEVICE } from "../support/buildTestContainer";
import { buildAdminTestContainer } from "../support/buildAdminTestContainer";

const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

test("RegisterUserUseCase: sends a welcome email in addition to the OTP emails", async () => {
  const container = buildTestContainer();

  await container.registerUser.execute({
    name: "New Renter",
    email: "new-renter@example.com",
    password: "correct horse battery staple",
    device: TEST_DEVICE,
  });

  const welcome = container.emailService.sent.find((m) => m.subject === "Welcome to RentIt");
  assert.ok(welcome, "expected a welcome email to have been sent");
  assert.equal(welcome?.to, "new-renter@example.com");
  assert.match(welcome!.text, /New Renter/);
});

test("ApprovePropertyUseCase: emails the owner and triggers the saved-search notification sweep", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin-approve@example.com" });
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-approve@example.com" });
  const seeker = await container.repos.userRepo.create({ name: "Seeker", email: "seeker-approve@example.com" });

  const savedSearch = await container.repos.savedSearchRepo.create({
    userId: seeker.id,
    name: "Anything in this category",
    filters: { categoryId: CATEGORY_ID },
    notifyOnMatch: true,
  });

  const property = await container.repos.propertyRepo.create({
    ownerId: owner.id,
    categoryId: CATEGORY_ID,
    title: "Approved Listing",
    description: "desc",
    propertyType: "apartment",
    rentAmount: 18000,
    securityDeposit: 36000,
    areaSqft: 650,
    bedrooms: 2,
    bathrooms: 1,
    parkingSpaces: 1,
    furnishedStatus: "unfurnished",
    availableFrom: "2026-08-01",
  });

  await container.approveProperty.execute({ propertyId: property.id, actorId: admin.id });

  const approvalEmail = container.emailService.sent.find((m) => m.subject === "Your listing has been approved");
  assert.ok(approvalEmail, "expected an approval email to the owner");
  assert.equal(approvalEmail?.to, "owner-approve@example.com");
  assert.match(approvalEmail!.text, /Approved Listing/);

  const seekerNotifications = await container.repos.notificationRepo.listForUser(seeker.id, {
    page: 1,
    pageSize: 10,
  });
  assert.equal(seekerNotifications.total, 1, "the matching saved search should have fired");

  const refreshedSearch = await container.repos.savedSearchRepo.findById(savedSearch.id);
  assert.ok(refreshedSearch?.lastNotifiedAt, "lastNotifiedAt should be stamped after a match");
});
