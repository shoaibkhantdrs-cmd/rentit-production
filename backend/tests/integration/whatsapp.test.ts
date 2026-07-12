import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPhase5TestContainer } from "../support/buildPhase5TestContainer";
import { ValidationError } from "@/domain/errors/AppError";

const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

async function makeListing(container: ReturnType<typeof buildPhase5TestContainer>, ownerPhone: string | null) {
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

test("ContactOwnerUseCase: sends the contact_owner template to the owner's phone", async () => {
  const container = buildPhase5TestContainer();
  const { property } = await makeListing(container, "+14155550100");
  const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter@example.com" });

  await container.contactOwner.execute({ propertyId: property.id, requesterId: requester.id });

  assert.equal(container.whatsAppService.sent.length, 1);
  assert.equal(container.whatsAppService.sent[0].template, "contact_owner");
  assert.equal(container.whatsAppService.sent[0].to, "+14155550100");
  assert.deepEqual(container.whatsAppService.sent[0].params, ["Renter", "Cozy Studio"]);
});

test("ContactOwnerUseCase: fails clearly when the owner has no phone on file", async () => {
  const container = buildPhase5TestContainer();
  const { property } = await makeListing(container, null);
  const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter2@example.com" });

  await assert.rejects(
    () => container.contactOwner.execute({ propertyId: property.id, requesterId: requester.id }),
    ValidationError,
  );
});

test("SendInquiryUseCase: carries the message text and enforces length/emptiness", async () => {
  const container = buildPhase5TestContainer();
  const { property } = await makeListing(container, "+14155550100");
  const requester = await container.repos.userRepo.create({ name: "Renter", email: "renter3@example.com" });

  await container.sendInquiry.execute({
    propertyId: property.id,
    requesterId: requester.id,
    message: "Is parking included?",
  });
  assert.equal(container.whatsAppService.sent[0].template, "send_inquiry");
  assert.deepEqual(container.whatsAppService.sent[0].params, [
    "Renter",
    "Cozy Studio",
    "Is parking included?",
  ]);

  await assert.rejects(
    () => container.sendInquiry.execute({ propertyId: property.id, requesterId: requester.id, message: "   " }),
    ValidationError,
  );
  await assert.rejects(
    () =>
      container.sendInquiry.execute({
        propertyId: property.id,
        requesterId: requester.id,
        message: "x".repeat(301),
      }),
    ValidationError,
  );
});

test("SharePropertyUseCase: builds a listing URL and doesn't require the sender to be signed in", async () => {
  const container = buildPhase5TestContainer();
  const { property } = await makeListing(container, "+14155550100");

  await container.shareProperty.execute({
    propertyId: property.id,
    toPhone: "+919876543210",
    frontendBaseUrl: "https://rentit.example",
  });

  assert.equal(container.whatsAppService.sent[0].template, "share_property");
  assert.equal(container.whatsAppService.sent[0].to, "+919876543210");
  assert.deepEqual(container.whatsAppService.sent[0].params, [
    "Cozy Studio",
    `https://rentit.example/properties/${property.id}`,
  ]);
});
