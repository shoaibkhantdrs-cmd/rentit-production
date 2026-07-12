import { INotificationRepository } from "@/domain/repositories/INotificationRepository";

export interface ListNotificationsInput {
  userId: string;
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

export class ListNotificationsUseCase {
  constructor(private readonly notificationRepo: INotificationRepository) {}

  async execute(input: ListNotificationsInput) {
    return this.notificationRepo.listForUser(input.userId, {
      page: input.page,
      pageSize: input.pageSize,
      unreadOnly: input.unreadOnly,
    });
  }
}
