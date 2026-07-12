import { ISmsService } from "@/domain/services/ISmsService";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Real Twilio Programmable Messaging REST API integration via the
 * platform's built-in `fetch` -- Twilio's API is plain HTTP + Basic Auth,
 * so (like GoogleGeocodingService) no SDK is needed even without npm
 * registry access.
 */
export class TwilioSmsService implements ISmsService {
  constructor(private readonly config: TwilioConfig) {}

  async send(to: string, body: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      "base64",
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.config.fromNumber, Body: body }).toString(),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Twilio SMS send failed with HTTP ${response.status}: ${detail}`);
    }
  }
}
