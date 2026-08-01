import { Twilio } from "twilio";
import { ISmsService } from "@/domain/services/ISmsService";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Stored phones aren't guaranteed to include a leading "+"/country code --
 * auth.schemas.ts/user.schemas.ts both accept `/^\+?[1-9]\d{7,14}$/`, so a
 * user may have saved a bare national number. Twilio's Messages API
 * requires a strict E.164 "to" address (leading "+") and will reject
 * anything else outright -- this was the most likely reason OTP SMS sends
 * were silently failing even with valid Twilio credentials configured.
 * Same India-only assumption already used in
 * PropertyDetailLoader.normalizePhone: a bare 10-digit number is assumed to
 * be missing its "91" prefix; anything already longer is assumed to
 * already include a country code.
 */
function toE164(raw: string): string {
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `+${withCountryCode}`;
}

/**
 * Real Twilio Programmable Messaging integration via the official `twilio`
 * SDK's `client.messages.create()` -- see backend/package.json for the
 * "twilio" dependency this requires. (An earlier version of this class
 * called Twilio's REST API directly over `fetch` to avoid adding an SDK
 * dependency; replaced with the official client for parity with Twilio's
 * own docs/error types and because `TWILIO_ACCOUNT_SID` et al. are already
 * configured in this project's Render environment.)
 */
export class TwilioSmsService implements ISmsService {
  private readonly client: Twilio;

  constructor(private readonly config: TwilioConfig) {
    this.client = new Twilio(config.accountSid, config.authToken);
  }

  async send(to: string, body: string): Promise<void> {
    try {
      await this.client.messages.create({
        to: toE164(to),
        from: this.config.fromNumber,
        body,
      });
    } catch (err) {
      // Twilio's SDK throws a RestException with .code/.status/.moreInfo --
      // surface the real reason (e.g. 21211 invalid "To" number, 21608
      // unverified "To" number on a trial account, 21606 "From" number not
      // owned/SMS-capable) instead of a bare "[object Object]". OtpIssuer
      // already catches this and converts it into a ServiceUnavailableError
      // for the client, logging the original message server-side.
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
      throw new Error(`Twilio SMS send failed: ${detail}`);
    }
  }
}
