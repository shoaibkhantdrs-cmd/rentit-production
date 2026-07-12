export type WhatsAppTemplateName = "contact_owner" | "share_property" | "send_inquiry";

export interface WhatsAppTemplateMessage {
  to: string; // E.164 phone number
  template: WhatsAppTemplateName;
  params: string[]; // positional template variables, in order
}

/**
 * Port over the WhatsApp Business Cloud API (Phase 5 Part 4). Kept
 * separate from ISmsService even though both ultimately reach a phone
 * number: WhatsApp only speaks in pre-approved message templates once a
 * 24h session window has closed, which is a materially different
 * contract than "send this arbitrary SMS body".
 */
export interface IWhatsAppService {
  sendTemplate(message: WhatsAppTemplateMessage): Promise<void>;
}
