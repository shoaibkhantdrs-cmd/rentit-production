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
  /**
   * Bulk equivalent of calling create() once per input, in a single round
   * trip. Added for BroadcastNotification, which used to insert up to 5,000
   * rows sequentially (one awaited INSERT at a time) on a single admin
   * request.
   */
  createMany(inputs: NewNotificationInput[]): Promise<Notification[]>;
  listForUser(userId: string, options: ListNotificationsOptions): Promise<ListNotificationsResult>;
  markRead(userId: string, ids: string[]): Promise<number>;
  markAllRead(userId: string): Promise<number>;
}
