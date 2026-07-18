"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUserDeviceRepository = void 0;
const ids_1 = require("./ids");
class InMemoryUserDeviceRepository {
    devices = new Map();
    async findByUserAndDeviceId(userId, deviceId) {
        for (const device of this.devices.values()) {
            if (device.userId === userId && device.deviceId === deviceId && !device.deletedAt) {
                return device;
            }
        }
        return null;
    }
    async upsert(input) {
        const existing = await this.findByUserAndDeviceId(input.userId, input.deviceId);
        const now = new Date();
        if (existing) {
            const updated = {
                ...existing,
                userAgent: input.userAgent,
                platform: input.platform,
                lastSeenAt: now,
                updatedAt: now,
            };
            this.devices.set(updated.id, updated);
            return updated;
        }
        const device = {
            id: (0, ids_1.newId)(),
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
    async setPushToken(userId, deviceId, pushToken) {
        const existing = await this.findByUserAndDeviceId(userId, deviceId);
        if (!existing)
            throw new Error(`No device ${deviceId} found for user ${userId}`);
        const updated = { ...existing, pushToken, updatedAt: new Date() };
        this.devices.set(updated.id, updated);
        return updated;
    }
    async listPushTokensForUsers(userIds) {
        const out = [];
        for (const device of this.devices.values()) {
            if (device.deletedAt || !device.pushToken)
                continue;
            if (!userIds.includes(device.userId))
                continue;
            out.push({ userId: device.userId, pushToken: device.pushToken });
        }
        return out;
    }
}
exports.InMemoryUserDeviceRepository = InMemoryUserDeviceRepository;
