export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Phase 5 Part 3. A dedicated, template-aware sibling to the generic
 * Phase 2 INotificationSender (which just moves a channel + body string).
 * IEmailService is what actually renders and sends a specific kind of
 * email; ChannelNotificationSender (infrastructure) implements
 * INotificationSender on top of this + ISmsService so nothing built on
 * INotificationSender since Phase 2 (OtpIssuer, password reset, ...)
 * has to change.
 */
export interface IEmailService {
  send(message: EmailMessage): Promise<void>;
}
