import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { UserPreference } from "@/domain/entities/UserPreference";
import { newId } from "./ids";

export class InMemoryUserPreferenceRepository implements IUserPreferenceRepository {
  public readonly preferences = new Map<string, UserPreference>(); // keyed by userId

  async findByUserId(userId: string): Promise<UserPreference | null> {
    return this.preferences.get(userId) ?? null;
  }

  async createDefault(userId: string): Promise<UserPreference> {
    const existing = this.preferences.get(userId);
    if (existing) return existing;

    const now = new Date();
    const pref: UserPreference = {
      id: newId(),
      userId,
      language: "en",
      timezone: "UTC",
      notifyEmail: true,
      notifySms: false,
      notifyPush: true,
      extra: {},
      createdAt: now,
      updatedAt: now,
    };
    this.preferences.set(userId, pref);
    return pref;
  }

  async update(userId: string, patch: Partial<UserPreference>): Promise<UserPreference> {
    const existing = this.preferences.get(userId);
    if (!existing) throw new Error(`Preferences for user ${userId} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    this.preferences.set(userId, updated);
    return updated;
  }
}
