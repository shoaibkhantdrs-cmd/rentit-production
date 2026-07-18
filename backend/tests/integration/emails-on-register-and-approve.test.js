"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildTestContainer_1 = require("../support/buildTestContainer");
const buildAdminTestContainer_1 = require("../support/buildAdminTestContainer");
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
(0, node_test_1.test)("RegisterUserUseCase: sends a welcome email in addition to the OTP emails", async () => {
    const container = (0, buildTestContainer_1.buildTestContainer)();
    await container.registerUser.execute({
        name: "New Renter",
        email: "new-renter@example.com",
        password: "correct horse battery staple",
        device: buildTestContainer_1.TEST_DEVICE,
    });
    const welcome = container.emailService.sent.find((m) => m.subject === "Welcome to RentIt");
    strict_1.default.ok(welcome, "expected a welcome email to have been sent");
    strict_1.default.equal(welcome?.to, "new-renter@example.com");
    strict_1.default.match(welcome.text, /New Renter/);
});
(0, node_test_1.test)("ApprovePropertyUseCase: emails the owner and triggers the saved-search notification sweep", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
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
    strict_1.default.ok(approvalEmail, "expected an approval email to the owner");
    strict_1.default.equal(approvalEmail?.to, "owner-approve@example.com");
    strict_1.default.match(approvalEmail.text, /Approved Listing/);
    const seekerNotifications = await container.repos.notificationRepo.listForUser(seeker.id, {
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(seekerNotifications.total, 1, "the matching saved search should have fired");
    const refreshedSearch = await container.repos.savedSearchRepo.findById(savedSearch.id);
    strict_1.default.ok(refreshedSearch?.lastNotifiedAt, "lastNotifiedAt should be stamped after a match");
});
