import { IOwnerDashboardRepository, OwnerDashboardStats } from "@/domain/repositories/IOwnerDashboardRepository";
import { InMemoryPropertyRepository } from "./InMemoryPropertyRepository";
import { InMemoryConversationRepository } from "./InMemoryConversationRepository";

/** In-memory stand-in for OwnerDashboardRepository. Reads across the other
 * fakes' public state (Maps) the same way the real repo reads across
 * Postgres tables -- no separate storage of its own, mirroring
 * InMemoryAdminAnalyticsRepository (Phase 4). */
export class InMemoryOwnerDashboardRepository implements IOwnerDashboardRepository {
  constructor(
    private readonly propertyRepo: InMemoryPropertyRepository,
    private readonly conversationRepo: InMemoryConversationRepository,
  ) {}

  async getStats(ownerId: string): Promise<OwnerDashboardStats> {
    // Same filter as PropertyRepository.findByOwner / InMemoryPropertyRepository's
    // own owner-scoped reads: owner_id match, not soft-deleted, every status.
    const ownedProperties = Array.from(this.propertyRepo.properties.values()).filter(
      (p) => p.ownerId === ownerId && !p.deletedAt,
    );

    const totalListings = ownedProperties.length;
    const totalViews = ownedProperties.reduce((sum, p) => sum + p.viewCount, 0);
    const totalFavorites = ownedProperties.reduce((sum, p) => sum + p.favoriteCount, 0);

    // One conversation = one enquiry. Mirrors the real SQL's INNER JOIN:
    // only conversations whose property_id resolves to one of this
    // owner's own non-deleted properties count -- general chats
    // (propertyId === null) and conversations about another owner's
    // property are excluded by construction.
    const ownedPropertyIds = new Set(ownedProperties.map((p) => p.id));
    const totalEnquiries = Array.from(this.conversationRepo.conversations.values()).filter(
      (c) => !c.deletedAt && c.propertyId !== null && ownedPropertyIds.has(c.propertyId),
    ).length;

    return { totalListings, totalViews, totalFavorites, totalEnquiries };
  }
}
