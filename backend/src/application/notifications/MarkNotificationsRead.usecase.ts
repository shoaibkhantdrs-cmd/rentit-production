import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";

export interface MarkNotificationsReadInput {
  userId: string;
  ids?: string[];
}

export class MarkNotificationsReadUseCase {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly activityLogRepo: IActivityLogRepository,
  ) {}

  async execute(input: MarkNotificationsReadInput): Promise<{ updated: number }> {
    const updated =
      input.ids && input.ids.length > 0
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
