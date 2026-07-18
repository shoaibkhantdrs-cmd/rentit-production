"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
const AppError_1 = require("@/domain/errors/AppError");
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
async function makeListing(container, ownerPhone) {
    const owner = await container.repos.userRepo.create({
        name: "Owner",
        email: `owner-${Date.now()}-${Math.random()}@example.com`,
        phone: ownerPhone ?? undefined,
    });
    const property = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: CATEGORY_ID,
        title: "Cozy Studio",
        description: "desc",
        propertyType: "studio",
        rentAmount: 12000,
        securityDeposit: 24000,
        areaSqft: 400,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "fully_furnished",
        availableFrom: "2026-08-01",
    });
    return { owner, property };
}
(0, node_test_1.test)("ContactOwnerUseCase: sends the contact_owner template to the owner's phone", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { property } = await makeListing(container, "+14155550100");
    const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter@example.com" });
    await container.contactOwner.execute({ propertyId: property.id, requesterId: requester.id });
    strict_1.default.equal(container.whatsAppService.sent.length, 1);
    strict_1.default.equal(container.whatsAppService.sent[0].template, "contact_owner");
    strict_1.default.equal(container.whatsAppService.sent[0].to, "+14155550100");
    strict_1.default.deepEqual(container.whatsAppService.sent[0].params, ["Renter", "Cozy Studio"]);
});
(0, node_test_1.test)("ContactOwnerUseCase: fails clearly when the owner has no phone on file", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { property } = await makeListing(container, null);
    const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter2@example.com" });
    await strict_1.default.rejects(() => container.contactOwner.execute({ propertyId: property.id, requesterId: requester.id }), AppError_1.ValidationError);
});
(0, node_test_1.test)("SendInquiryUseCase: carries the message text and enforces length/emptiness", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { property } = await makeListing(container, "+14155550100");
    const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter3@example.com" });
    await container.sendInquiry.execute({
        propertyId: property.id,
        requesterId: requester.id,
        message: "Is parking included?",
    });
    strict_1.default.equal(container.whatsAppService.sent[0].template, "send_inquiry");
    strict_1.default.deepEqual(container.whatsAppService.sent[0].params, [
        "Renter",
        "Cozy Studio",
        "Is parking included?",
    ]);
    await strict_1.default.rejects(() => container.sendInquiry.execute({ propertyId: property.id, requesterId: requester.id, message: "   " }), AppError_1.ValidationError);
    await strict_1.default.rejects(() => container.sendInquiry.execute({
        propertyId: property.id,
        requesterId: requester.id,
        message: "x".repeat(301),
    }), AppError_1.ValidationError);
});
(0, node_test_1.test)("SharePropertyUseCase: builds a listing URL and doesn't require the sender to be signed in", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const { property } = await makeListing(container, "+14155550100");
    await container.shareProperty.execute({
        propertyId: property.id,
        toPhone: "+919876543210",
        frontendBaseUrl: "https://rentit.example",
    });
    strict_1.default.equal(container.whatsAppService.sent[0].template, "share_property");
    strict_1.default.equal(container.whatsAppService.sent[0].to, "+919876543210");
    strict_1.default.deepEqual(container.whatsAppService.sent[0].params, [
        "Cozy Studio",
        `https://rentit.example/properties/${property.id}`,
    ]);
});
