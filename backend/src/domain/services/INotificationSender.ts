export type NotificationChannel = "email" | "sms";

export interface SendNotificationInput {
  channel: NotificationChannel;
  to: string; // email address or phone number
  subject?: string;
  body: string;
}

/**
 * Port for actually delivering a message outside the system (as opposed to
 * INotificationRepository, which persists the in-app notification record).
 * Swap the bound implementation to add real email/SMS providers without
 * touching any use-case -- see infrastructure/notifications/.
 */
export interface INotificationSender {
  send(input: SendNotificationInput): Promise<void>;
}
