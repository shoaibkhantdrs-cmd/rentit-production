export type DevicePlatform = "web" | "ios" | "android" | "unknown";

export interface UserDevice {
  id: string;
  userId: string;
  deviceId: string;
  platform: DevicePlatform;
  userAgent: string | null;
  isTrusted: boolean;
  /** Phase 5 Part 2 (Push Notifications) addition -- an FCM registration
   * token for this device, or null until the client registers one. */
  pushToken: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
