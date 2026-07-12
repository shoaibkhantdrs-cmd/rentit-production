import { UserPreference } from "@/domain/entities/UserPreference";

export interface IUserPreferenceRepository {
  findByUserId(userId: string): Promise<UserPreference | null>;
  createDefault(userId: string): Promise<UserPreference>;
  update(userId: string, patch: Partial<UserPreference>): Promise<UserPreference>;
}
