"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListNotificationsUseCase = void 0;
class ListNotificationsUseCase {
    notificationRepo;
    constructor(notificationRepo) {
        this.notificationRepo = notificationRepo;
    }
    async execute(input) {
        return this.notificationRepo.listForUser(input.userId, {
            page: input.page,
            pageSize: input.pageSize,
            unreadOnly: input.unreadOnly,
        });
    }
}
exports.ListNotificationsUseCase = ListNotificationsUseCase;
