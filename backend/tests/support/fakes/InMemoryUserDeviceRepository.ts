import {
  IUserDeviceRepository,
  UpsertUserDeviceInput,
} from "@/domain/repositories/IUserDeviceRepository";
import { UserDevice } from "@/domain/entities/UserDevice";
import { newId } from "./ids";

export class InMemoryUserDeviceRepository implements IUserDeviceRepository {
  public readonly devices = new Map<string, UserDevice>();

  async findByUserAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null> {
    for (const device of this.devices.values()) {
      if (device.userId === userId && device.deviceId === deviceId && !device.deletedAt) {
        return device;
      }
    }
    return null;
  }

  async upsert(input: UpsertUserDeviceInput): Promise<UserDevice> {
    const existing = await this.findByUserAndDeviceId(input.userId, input.deviceId);
    const now = new Date();

    if (existing) {
      const updated: UserDevice = {
        ...existing,
        userAgent: input.userAgent,
        platform: input.platform,
        lastSeenAt: now,
        updatedAt: now,
      };
      this.devices.set(updated.id, updated);
      return updated;
    }

    const device: UserDevice = {
      id: newId(),
      userId: input.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      userAgent: input.userAgent,
      isTrusted: false,
      pushToken: null,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.devices.set(device.id, device);
    return device;
  }

  async setPushToken(userId: string, deviceId: string, pushToken: string | null): Promise<UserDevice> {
    const existing = await this.findByUserAndDeviceId(userId, deviceId);
    if (!existing) throw new Error(`No device ${deviceId} found for user ${userId}`);
    const updated: UserDevice = { ...existing, pushToken, updatedAt: new Date() };
    this.devices.set(updated.id, updated);
    return updated;
  }

  async listPushTokensForUsers(
    userIds: string[],
  ): Promise<Array<{ userId: string; pushToken: string }>> {
    const out: Array<{ userId: string; pushToken: string }> = [];
    for (const device of this.devices.values()) {
      if (device.deletedAt || !device.pushToken) continue;
      if (!userIds.includes(device.userId)) continue;
      out.push({ userId: device.userId, pushToken: device.pushToken });
    }
    return out;
  }
}
