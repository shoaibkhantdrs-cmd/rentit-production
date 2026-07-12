import { Notification } from "@/domain/entities/Notification";

export interface NewNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ListNotificationsOptions {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

export interface ListNotificationsResult {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface INotificationRepository {
  create(input: NewNotificationInput): Promise<Notification>;
  listForUser(userId: string, options: ListNotificationsOptions): Promise<ListNotificationsResult>;
  markRead(userId: string, ids: string[]): Promise<number>;
  markAllRead(userId: string): Promise<number>;
}
