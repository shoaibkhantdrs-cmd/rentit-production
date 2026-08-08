import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPhase5TestContainer } from "../support/buildPhase5TestContainer";
import { PropertyController } from "@/interfaces/http/controllers/PropertyController";

// Phase 3 Part 3 (Owner Dashboard, must-have slice).
//
// GetOwnerDashboardStatsUseCase / OwnerDashboardRepository are exercised
// here through buildPhase5TestContainer() (it already wires both
// propertyRepo and conversationRepo, which InMemoryOwnerDashboardRepository
// reads across -- see that fake's doc comment) at the use-case level, the
// same convention every other integration test in this backend follows
// (no HTTP/supertest layer exists anywhere in this test suite).
//
// One exception: "unauthenticated request returns 401" is a property of
// PropertyController.myStats' own `if (!req.user) throw new
// UnauthorizedError()` guard, not of the use case (the use case always
// receives a concrete ownerId and has no concept of "unauthenticated").
// That guard is identical, unmodified boilerplate already used unchanged
// on `mine`/`favorites`/etc. and isn't tested anywhere else in this suite
// either -- but since it's explicitly required here, it's covered by
// constructing PropertyController directly and calling the one handler
// under test. Every other constructor dependency is irrelevant to
// `myStats` and is stubbed with `null` via an `any` cast to avoid importing
// seventeen unrelated use-case types just for their names.

function buildBareController(getOwnerDashboardStats: unknown): PropertyController {
  return new (PropertyController as unknown as new (...args: unknown[]) => PropertyController)(
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    getOwnerDashboardStats,
  );
}

function fakeResponse() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

const BASE_PROPERTY = {
  categoryId: "00000000-0000-0000-0000-000000000001",
  title: "Listing",
  description: "desc",
  propertyType: "apartment" as const,
  rentAmount: 10000,
  securityDeposit: 20000,
  areaSqft: 500,
  bedrooms: 1,
  bathrooms: 1,
  parkingSpaces: 0,
  furnishedStatus: "unfurnished" as const,
  availableFrom: "2026-08-01",
};

test("GetOwnerDashboardStatsUseCase: an owner with zero listings gets all zeros", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-zero@example.com" });

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.deepEqual(stats, { totalListings: 0, totalViews: 0, totalFavorites: 0, totalEnquiries: 0 });
});

test("GetOwnerDashboardStatsUseCase: sums views and favorites across every listing this owner has", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-sums@example.com" });

  const listingA = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "A" });
  const listingB = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "B" });
  await container.repos.propertyRepo.update(listingA.id, { viewCount: 10, favoriteCount: 2 });
  await container.repos.propertyRepo.update(listingB.id, { viewCount: 5, favoriteCount: 1 });

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.equal(stats.totalListings, 2);
  assert.equal(stats.totalViews, 15);
  assert.equal(stats.totalFavorites, 3);
});

test("GetOwnerDashboardStatsUseCase: a second owner's listings, views, and favorites are never included", async () => {
  const container = buildPhase5TestContainer();
  const ownerA = await container.repos.userRepo.create({ name: "Owner A", email: "owner-a@example.com" });
  const ownerB = await container.repos.userRepo.create({ name: "Owner B", email: "owner-b@example.com" });

  const listingA = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: ownerA.id, title: "A" });
  await container.repos.propertyRepo.update(listingA.id, { viewCount: 3, favoriteCount: 1 });
  const listingB = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: ownerB.id, title: "B" });
  await container.repos.propertyRepo.update(listingB.id, { viewCount: 100, favoriteCount: 50 });

  const statsA = await container.getOwnerDashboardStats.execute({ ownerId: ownerA.id });
  assert.deepEqual(statsA, { totalListings: 1, totalViews: 3, totalFavorites: 1, totalEnquiries: 0 });
});

test("GetOwnerDashboardStatsUseCase: a soft-deleted listing is excluded from every total", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-deleted@example.com" });

  const kept = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "Kept" });
  await container.repos.propertyRepo.update(kept.id, { viewCount: 4, favoriteCount: 1 });
  const removed = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "Gone" });
  await container.repos.propertyRepo.update(removed.id, { viewCount: 999, favoriteCount: 999 });
  await container.repos.propertyRepo.softDelete(removed.id);

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.deepEqual(stats, { totalListings: 1, totalViews: 4, totalFavorites: 1, totalEnquiries: 0 });
});

test("GetOwnerDashboardStatsUseCase: a listing with status 'removed' (not soft-deleted) still counts, matching /properties/mine", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-removed-status@example.com" });

  const removedStatus = await container.repos.propertyRepo.create({
    ...BASE_PROPERTY,
    ownerId: owner.id,
    title: "Moderated away",
  });
  await container.repos.propertyRepo.update(removedStatus.id, {
    status: "removed",
    viewCount: 7,
    favoriteCount: 2,
  });

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.deepEqual(stats, { totalListings: 1, totalViews: 7, totalFavorites: 2, totalEnquiries: 0 });
});

test("GetOwnerDashboardStatsUseCase: one conversation = one enquiry, regardless of message count", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-enq@example.com" });
  const renter = await container.repos.userRepo.create({ name: "Renter", email: "renter-enq@example.com" });
  const listing = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "Listing" });
  await container.repos.propertyRepo.update(listing.id, { status: "published" });

  const conversation = await container.startConversation.execute({
    initiatorId: renter.id,
    recipientId: owner.id,
    propertyId: listing.id,
  });
  if (!conversation) throw new Error("expected a conversation");

  await container.sendMessage.execute({ conversationId: conversation.id, senderId: renter.id, body: "Hi!" });
  await container.sendMessage.execute({ conversationId: conversation.id, senderId: owner.id, body: "Hello!" });
  await container.sendMessage.execute({ conversationId: conversation.id, senderId: renter.id, body: "Still available?" });

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.equal(stats.totalEnquiries, 1);
});

test("GetOwnerDashboardStatsUseCase: a general conversation (propertyId null) is excluded from enquiries", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-general@example.com" });
  const other = await container.repos.userRepo.create({ name: "Other", email: "other-general@example.com" });

  await container.startConversation.execute({ initiatorId: other.id, recipientId: owner.id, propertyId: null });

  const stats = await container.getOwnerDashboardStats.execute({ ownerId: owner.id });
  assert.equal(stats.totalEnquiries, 0);
});

test("GetOwnerDashboardStatsUseCase: a conversation about another owner's property is excluded from enquiries", async () => {
  const container = buildPhase5TestContainer();
  const ownerA = await container.repos.userRepo.create({ name: "Owner A", email: "owner-a2@example.com" });
  const ownerB = await container.repos.userRepo.create({ name: "Owner B", email: "owner-b2@example.com" });
  const renter = await container.repos.userRepo.create({ name: "Renter", email: "renter-cross@example.com" });

  const listingB = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: ownerB.id, title: "B's listing" });
  await container.repos.propertyRepo.update(listingB.id, { status: "published" });

  await container.startConversation.execute({
    initiatorId: renter.id,
    recipientId: ownerB.id,
    propertyId: listingB.id,
  });

  const statsA = await container.getOwnerDashboardStats.execute({ ownerId: ownerA.id });
  const statsB = await container.getOwnerDashboardStats.execute({ ownerId: ownerB.id });
  assert.equal(statsA.totalEnquiries, 0);
  assert.equal(statsB.totalEnquiries, 1);
});

test("PropertyController.myStats: unauthenticated request throws UnauthorizedError, never reaching the repository", async () => {
  const container = buildPhase5TestContainer();
  const controller = buildBareController(container.getOwnerDashboardStats);
  const res = fakeResponse();

  await assert.rejects(
    () => controller.myStats({ user: undefined } as never, res as never),
    (err: Error) => {
      assert.equal(err.constructor.name, "UnauthorizedError");
      return true;
    },
  );
  assert.equal(res.statusCode, 0, "no response should have been sent for an unauthenticated request");
});

test("PropertyController.myStats: ownerId is taken exclusively from req.user.sub, never from any other field", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-controller@example.com" });
  const listing = await container.repos.propertyRepo.create({ ...BASE_PROPERTY, ownerId: owner.id, title: "Listing" });
  await container.repos.propertyRepo.update(listing.id, { viewCount: 6, favoriteCount: 2 });

  const controller = buildBareController(container.getOwnerDashboardStats);
  const res = fakeResponse();

  // A request object with an ownerId-shaped field anywhere other than
  // req.user.sub must be ignored -- there is no code path in myStats that
  // reads req.query, req.body, or req.params at all.
  const req = {
    user: { sub: owner.id },
    query: { ownerId: "attacker-supplied-id" },
    body: { ownerId: "attacker-supplied-id" },
    params: { ownerId: "attacker-supplied-id" },
  };

  await controller.myStats(req as never, res as never);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { totalListings: 1, totalViews: 6, totalFavorites: 2, totalEnquiries: 0 });
});
