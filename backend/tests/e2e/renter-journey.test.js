"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
/**
 * Phase 5 Part 9 asks for End-to-End tests specifically, distinct from
 * unit/integration. A literal browser-driven E2E test (spinning up the
 * real Express app + a browser against it) isn't possible in this
 * sandbox: the real container.ts/app.ts import 'pg', 'bcrypt',
 * 'express', 'multer', etc., none of which are installed here (no npm
 * registry access -- the same constraint documented in every prior
 * phase's docs/phase-N.md). What *is* achievable, and what this file
 * does, is the sandbox-honest equivalent already established for this
 * project: exercise a full, realistic multi-step user journey across
 * several real use-cases chained together against the same in-memory
 * fakes, rather than isolating one use-case per test the way the
 * integration suite does. This is "end to end" in the sense of covering
 * the whole flow a person actually takes, even though the transport is a
 * fake, not a socket.
 */
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
(0, node_test_1.test)("End-to-end: a saved search fires, then the seeker views, chats, and WhatsApps the owner", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    // 1. Two people exist: an owner and a prospective renter.
    const owner = await container.repos.userRepo.create({
        name: "Priya",
        email: "priya@example.com",
        phone: "+919812300001",
    });
    const seeker = await container.repos.userRepo.create({ name: "Raj", email: "raj@example.com" });
    // 2. Raj saves a search for cheap apartments and wants to be notified.
    const savedSearch = await container.createSavedSearch.execute({
        userId: seeker.id,
        name: "Budget apartments",
        filters: { categoryId: CATEGORY_ID, rentMax: 18000 },
        notifyOnMatch: true,
    });
    // 3. Priya's listing goes live (in the real app this happens inside
    // ApprovePropertyUseCase; here we drive the same repo + notify step
    // that use-case calls, since admin moderation lives in a separate
    // container from Phase 5's own use-cases).
    const property = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: CATEGORY_ID,
        title: "Sunny 1BHK near the metro",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 16000,
        securityDeposit: 32000,
        areaSqft: 550,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "semi_furnished",
        availableFrom: "2026-08-01",
    });
    await container.repos.propertyRepo.update(property.id, { status: "published", publishedAt: new Date() });
    await container.notifySavedSearchesForProperty.execute({ ...property, status: "published" });
    // 4. Raj gets notified.
    const notifications = await container.repos.notificationRepo.listForUser(seeker.id, { page: 1, pageSize: 10 });
    strict_1.default.equal(notifications.total, 1);
    strict_1.default.equal(notifications.items[0].data?.propertyId, property.id);
    // 5. Raj views the listing -- it should now show up in his recently-viewed.
    await container.repos.propertyViewRepo.record({
        propertyId: property.id,
        viewerUserId: seeker.id,
        ipAddress: null,
        userAgent: null,
    });
    const recentlyViewed = await container.getRecentlyViewed.execute(seeker.id);
    strict_1.default.equal(recentlyViewed.items[0]?.id, property.id);
    // 6. Raj starts a property-scoped chat with Priya and asks a question.
    const conversation = await container.startConversation.execute({
        initiatorId: seeker.id,
        recipientId: owner.id,
        propertyId: property.id,
    });
    await container.sendMessage.execute({
        conversationId: conversation.id,
        senderId: seeker.id,
        body: "Is this still available for a September move-in?",
    });
    const ownerUnread = await container.getUnreadMessageCount.execute(owner.id);
    strict_1.default.equal(ownerUnread.unreadCount, 1);
    // 7. Priya reads it.
    await container.markConversationRead.execute({ conversationId: conversation.id, userId: owner.id });
    const ownerUnreadAfter = await container.getUnreadMessageCount.execute(owner.id);
    strict_1.default.equal(ownerUnreadAfter.unreadCount, 0);
    // 8. Raj also pings Priya on WhatsApp, belt-and-suspenders.
    await container.contactOwner.execute({ propertyId: property.id, requesterId: seeker.id });
    strict_1.default.equal(container.whatsAppService.sent.length, 1);
    strict_1.default.equal(container.whatsAppService.sent[0].to, "+919812300001");
    // 9. Now that Raj has viewed and favorited-adjacent behavior exists,
    // he should get recommendations back for the same category/price band.
    const secondListing = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: CATEGORY_ID,
        title: "Another budget 1BHK",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 16500,
        securityDeposit: 33000,
        areaSqft: 560,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-15",
    });
    await container.repos.propertyRepo.update(secondListing.id, { status: "published", publishedAt: new Date() });
    const recommendations = await container.getRecommendations.execute({ propertyId: property.id });
    strict_1.default.ok(recommendations.items.some((i) => i.id === secondListing.id));
    // Sanity check on the saved search itself: it should be marked notified.
    const refreshedSearch = await container.repos.savedSearchRepo.findById(savedSearch.id);
    strict_1.default.ok(refreshedSearch?.lastNotifiedAt);
});
