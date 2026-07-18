"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryPropertyViewRepository = void 0;
const ids_1 = require("./ids");
class InMemoryPropertyViewRepository {
    clock;
    views = [];
    constructor(clock) {
        this.clock = clock;
    }
    async record(input) {
        const view = {
            id: (0, ids_1.newId)(),
            propertyId: input.propertyId,
            viewerUserId: input.viewerUserId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            viewedAt: this.clock.now(),
        };
        this.views.push(view);
        return view;
    }
    async hasRecentView(propertyId, viewerKey, sinceMinutesAgo) {
        const cutoff = this.clock.now().getTime() - sinceMinutesAgo * 60_000;
        return this.views.some((view) => {
            const key = view.viewerUserId ?? view.ipAddress ?? "anonymous";
            return view.propertyId === propertyId && key === viewerKey && view.viewedAt.getTime() >= cutoff;
        });
    }
    async listRecentPropertyIdsForUser(userId, limit) {
        const seen = new Set();
        const ordered = [...this.views]
            .filter((v) => v.viewerUserId === userId)
            .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime());
        const ids = [];
        for (const view of ordered) {
            if (seen.has(view.propertyId))
                continue;
            seen.add(view.propertyId);
            ids.push(view.propertyId);
            if (ids.length >= limit)
                break;
        }
        return ids;
    }
}
exports.InMemoryPropertyViewRepository = InMemoryPropertyViewRepository;
