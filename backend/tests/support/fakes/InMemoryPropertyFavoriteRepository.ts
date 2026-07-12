import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { PropertyFavorite } from "@/domain/entities/PropertyFavorite";
import { newId } from "./ids";

export class InMemoryPropertyFavoriteRepository implements IPropertyFavoriteRepository {
  public readonly favorites = new Map<string, PropertyFavorite>();

  private key(propertyId: string, userId: string): string {
    return `${propertyId}:${userId}`;
  }

  async add(propertyId: string, userId: string): Promise<boolean> {
    const key = this.key(propertyId, userId);
    if (this.favorites.has(key)) return false;
    this.favorites.set(key, { id: newId(), propertyId, userId, createdAt: new Date() });
    return true;
  }

  async remove(propertyId: string, userId: string): Promise<boolean> {
    return this.favorites.delete(this.key(propertyId, userId));
  }

  async exists(propertyId: string, userId: string): Promise<boolean> {
    return this.favorites.has(this.key(propertyId, userId));
  }

  async listPropertyIdsForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ ids: string[]; total: number }> {
    // Most-recently-favorited first, mirroring "ORDER BY created_at DESC".
    const all = Array.from(this.favorites.values())
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = (page - 1) * pageSize;
    const ids = all.slice(offset, offset + pageSize).map((f) => f.propertyId);

    return { ids, total: all.length };
  }
}
