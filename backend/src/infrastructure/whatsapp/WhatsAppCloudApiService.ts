import { IWhatsAppService, WhatsAppTemplateMessage } from "@/domain/services/IWhatsAppService";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Real WhatsApp Business Cloud API (Meta Graph API) integration via
 * `fetch` -- again a plain HTTPS + Bearer token REST call, so no SDK
 * dependency is needed. Templates must already be created and approved
 * in the WhatsApp Business Manager under these exact names
 * (contact_owner / share_property / send_inquiry) -- see docs/phase-5.md
 * Provider Setup for what to register there.
 */
export class WhatsAppCloudApiService implements IWhatsAppService {
  constructor(private readonly config: WhatsAppConfig) {}

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<void> {
    const url = `https://graph.facebook.com/v19.0/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "template",
        template: {
          name: message.template,
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: message.params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`WhatsApp send failed with HTTP ${response.status}: ${detail}`);
    }
  }
}
