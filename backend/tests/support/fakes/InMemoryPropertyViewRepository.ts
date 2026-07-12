import {
  IPropertyViewRepository,
  NewPropertyViewInput,
} from "@/domain/repositories/IPropertyViewRepository";
import { PropertyView } from "@/domain/entities/PropertyView";
import { IClock } from "@/domain/services/IClock";
import { newId } from "./ids";

export class InMemoryPropertyViewRepository implements IPropertyViewRepository {
  public readonly views: PropertyView[] = [];

  constructor(private readonly clock: IClock) {}

  async record(input: NewPropertyViewInput): Promise<PropertyView> {
    const view: PropertyView = {
      id: newId(),
      propertyId: input.propertyId,
      viewerUserId: input.viewerUserId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      viewedAt: this.clock.now(),
    };
    this.views.push(view);
    return view;
  }

  async hasRecentView(propertyId: string, viewerKey: string, sinceMinutesAgo: number): Promise<boolean> {
    const cutoff = this.clock.now().getTime() - sinceMinutesAgo * 60_000;
    return this.views.some((view) => {
      const key = view.viewerUserId ?? view.ipAddress ?? "anonymous";
      return view.propertyId === propertyId && key === viewerKey && view.viewedAt.getTime() >= cutoff;
    });
  }

  async listRecentPropertyIdsForUser(userId: string, limit: number): Promise<string[]> {
    const seen = new Set<string>();
    const ordered = [...this.views]
      .filter((v) => v.viewerUserId === userId)
      .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime());

    const ids: string[] = [];
    for (const view of ordered) {
      if (seen.has(view.propertyId)) continue;
      seen.add(view.propertyId);
      ids.push(view.propertyId);
      if (ids.length >= limit) break;
    }
    return ids;
  }
}
