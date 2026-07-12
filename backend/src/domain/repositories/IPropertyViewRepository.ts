import { PropertyView } from "@/domain/entities/PropertyView";

export interface NewPropertyViewInput {
  propertyId: string;
  viewerUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IPropertyViewRepository {
  record(input: NewPropertyViewInput): Promise<PropertyView>;
  /** Used to de-duplicate view-count increments from the same viewer in a short window. */
  hasRecentView(propertyId: string, viewerKey: string, sinceMinutesAgo: number): Promise<boolean>;
  /** Phase 5 Part 6 (Recently Viewed): the most recent distinct properties
   * a logged-in user has viewed, newest first. Reuses the view log that
   * GetPropertyUseCase has been writing to since Phase 3 -- no new table. */
  listRecentPropertyIdsForUser(userId: string, limit: number): Promise<string[]>;
}
