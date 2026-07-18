"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryUserPreferenceRepository = void 0;
const ids_1 = require("./ids");
class InMemoryUserPreferenceRepository {
    preferences = new Map(); // keyed by userId
    async findByUserId(userId) {
        return this.preferences.get(userId) ?? null;
    }
    async createDefault(userId) {
        const existing = this.preferences.get(userId);
        if (existing)
            return existing;
        const now = new Date();
        const pref = {
            id: (0, ids_1.newId)(),
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
    async update(userId, patch) {
        const existing = this.preferences.get(userId);
        if (!existing)
            throw new Error(`Preferences for user ${userId} not found`);
        const updated = { ...existing, ...patch, updatedAt: new Date() };
        this.preferences.set(userId, updated);
        return updated;
    }
}
exports.InMemoryUserPreferenceRepository = InMemoryUserPreferenceRepository;
