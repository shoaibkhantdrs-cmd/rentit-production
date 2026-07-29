"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkNotificationsReadUseCase = void 0;
class MarkNotificationsReadUseCase {
    notificationRepo;
    activityLogRepo;
    constructor(notificationRepo, activityLogRepo) {
        this.notificationRepo = notificationRepo;
        this.activityLogRepo = activityLogRepo;
    }
    async execute(input) {
        const updated = input.ids && input.ids.length > 0
            ? await this.notificationRepo.markRead(input.userId, input.ids)
            : await this.notificationRepo.markAllRead(input.userId);
        await this.activityLogRepo.record({
            userId: input.userId,
            action: "notifications.marked_read",
            metadata: { count: updated },
        });
        return { updated };
    }
}
exports.MarkNotificationsReadUseCase = MarkNotificationsReadUseCase;
