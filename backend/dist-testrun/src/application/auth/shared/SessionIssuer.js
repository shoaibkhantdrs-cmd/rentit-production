"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionIssuer = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * Centralizes "create device + session + refresh token + access token" --
 * the exact same sequence is needed by register, password login, OTP
 * login, and is a *new* family each time (as opposed to RefreshToken
 * rotation, which reuses the existing family). Kept out of individual
 * use-cases so the rotation/reuse-detection logic in RefreshToken.usecase
 * is the only other place that touches refresh_tokens directly.
 */
class SessionIssuer {
    userDeviceRepo;
    sessionRepo;
    refreshTokenRepo;
    tokenService;
    clock;
    config;
    constructor(userDeviceRepo, sessionRepo, refreshTokenRepo, tokenService, clock, config) {
        this.userDeviceRepo = userDeviceRepo;
        this.sessionRepo = sessionRepo;
        this.refreshTokenRepo = refreshTokenRepo;
        this.tokenService = tokenService;
        this.clock = clock;
        this.config = config;
    }
    async issue(userId, roles, device) {
        const userDevice = await this.userDeviceRepo.upsert({
            userId,
            deviceId: device.deviceId,
            platform: device.platform,
            userAgent: device.userAgent,
        });
        const expiresAt = new Date(this.clock.now().getTime() + this.config.refreshTokenTtlSeconds * 1000);
        const session = await this.sessionRepo.create({
            userId,
            deviceId: userDevice.id,
            ipAddress: device.ipAddress,
            userAgent: device.userAgent,
            expiresAt,
        });
        const rawRefreshToken = this.tokenService.generateOpaqueToken();
        const tokenHash = this.tokenService.hashOpaqueToken(rawRefreshToken);
        const familyId = (0, node_crypto_1.randomUUID)();
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
exports.SessionIssuer = SessionIssuer;
