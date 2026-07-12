import {
  INotificationRepository,
  ListNotificationsOptions,
  ListNotificationsResult,
  NewNotificationInput,
} from "@/domain/repositories/INotificationRepository";
import { Notification } from "@/domain/entities/Notification";
import { newId } from "./ids";

export class InMemoryNotificationRepository implements INotificationRepository {
  public readonly notifications = new Map<string, Notification>();

  async create(input: NewNotificationInput): Promise<Notification> {
    const now = new Date();
    const notification: Notification = {
      id: newId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      readAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async listForUser(
    userId: string,
    options: ListNotificationsOptions,
  ): Promise<ListNotificationsResult> {
    let items = [...this.notifications.values()].filter(
      (n) => n.userId === userId && !n.deletedAt,
    );
    if (options.unreadOnly) {
      items = items.filter((n) => !n.readAt);
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const start = (options.page - 1) * options.pageSize;
    const page = items.slice(start, start + options.pageSize);

    return { items: page, total, page: options.page, pageSize: options.pageSize };
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      const n = this.notifications.get(id);
      if (n && n.userId === userId && !n.readAt) {
        this.notifications.set(id, { ...n, readAt: new Date(), updatedAt: new Date() });
        count += 1;
      }
    }
    return count;
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (n.userId === userId && !n.readAt && !n.deletedAt) {
        this.notifications.set(n.id, { ...n, readAt: new Date(), updatedAt: new Date() });
        count += 1;
      }
    }
    return count;
  }
}
