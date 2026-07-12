import { randomUUID } from "node:crypto";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { IUserDeviceRepository } from "@/domain/repositories/IUserDeviceRepository";
import { ITokenService } from "@/domain/services/ITokenService";
import { IClock } from "@/domain/services/IClock";
import { DevicePlatform } from "@/domain/entities/UserDevice";
import { AuthConfig } from "@/application/dtos/AuthConfig";

export interface DeviceContext {
  deviceId: string;
  platform: DevicePlatform;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

/**
 * Centralizes "create device + session + refresh token + access token" --
 * the exact same sequence is needed by register, password login, OTP
 * login, and is a *new* family each time (as opposed to RefreshToken
 * rotation, which reuses the existing family). Kept out of individual
 * use-cases so the rotation/reuse-detection logic in RefreshToken.usecase
 * is the only other place that touches refresh_tokens directly.
 */
export class SessionIssuer {
  constructor(
    private readonly userDeviceRepo: IUserDeviceRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly tokenService: ITokenService,
    private readonly clock: IClock,
    private readonly config: AuthConfig,
  ) {}

  async issue(userId: string, roles: string[], device: DeviceContext): Promise<IssuedTokens> {
    const userDevice = await this.userDeviceRepo.upsert({
      userId,
      deviceId: device.deviceId,
      platform: device.platform,
      userAgent: device.userAgent,
    });

    const expiresAt = new Date(
      this.clock.now().getTime() + this.config.refreshTokenTtlSeconds * 1000,
    );

    const session = await this.sessionRepo.create({
      userId,
      deviceId: userDevice.id,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      expiresAt,
    });

    const rawRefreshToken = this.tokenService.generateOpaqueToken();
    const tokenHash = this.tokenService.hashOpaqueToken(rawRefreshToken);
    const familyId = randomUUID();

    await this.refreshTokenRepo.create({
      userId,
      sessionId: session.id,
      tokenHash,
      familyId,
      expiresAt,
    });

    const accessToken = this.tokenService.signAccessToken({
      sub: userId,
      roles,
      sessionId: session.id,
    });

    return { accessToken, refreshToken: rawRefreshToken, sessionId: session.id };
  }
}
