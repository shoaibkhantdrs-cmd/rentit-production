import { UserDevice } from "@/domain/entities/UserDevice";

export interface UpsertUserDeviceInput {
  userId: string;
  deviceId: string;
  platform: UserDevice["platform"];
  userAgent: string | null;
}

export interface IUserDeviceRepository {
  findByUserAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null>;
  /** Creates the device on first sight, otherwise bumps last_seen_at/user_agent. */
  upsert(input: UpsertUserDeviceInput): Promise<UserDevice>;
  /** Phase 5 Part 2: register/clear this device's FCM token. Passing null
   * clears it (e.g. on logout, so a signed-out device stops receiving push). */
  setPushToken(userId: string, deviceId: string, pushToken: string | null): Promise<UserDevice>;
  /** All push tokens for a user across every device that has one -- used
   * to fan a single push notification out to every device they're signed
   * into. */
  listPushTokensForUsers(userIds: string[]): Promise<Array<{ userId: string; pushToken: string }>>;
}
