import { IUserDeviceRepository } from "@/domain/repositories/IUserDeviceRepository";
import { DevicePlatform } from "@/domain/entities/UserDevice";

export interface RegisterPushTokenInput {
  userId: string;
  deviceId: string;
  platform: DevicePlatform;
  userAgent: string | null;
  pushToken: string | null; // null clears registration (e.g. on logout)
}

export class RegisterPushTokenUseCase {
  constructor(private readonly userDeviceRepo: IUserDeviceRepository) {}

  async execute(input: RegisterPushTokenInput): Promise<void> {
    // Upsert first so this is safe to call even if, for whatever reason,
    // login's own device upsert hasn't landed yet for this device.
    await this.userDeviceRepo.upsert({
      userId: input.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      userAgent: input.userAgent,
    });
    await this.userDeviceRepo.setPushToken(input.userId, input.deviceId, input.pushToken);
  }
}
