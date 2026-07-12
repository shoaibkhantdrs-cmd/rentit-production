/**
 * Phase 5 Part 3's "SMS provider abstraction" bullet, as its own named
 * port (as opposed to folding it into IEmailService) so a real provider
 * (Twilio, etc.) can be swapped in container.ts without touching
 * anything upstream. See IEmailService.ts for why this is separate from
 * the Phase 2 INotificationSender.
 */
export interface ISmsService {
  send(to: string, body: string): Promise<void>;
}
