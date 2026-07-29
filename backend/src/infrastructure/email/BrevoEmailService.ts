import { EmailMessage, IEmailService } from "@/domain/services/IEmailService";

export interface BrevoConfig {
  apiKey: string;
  fromAddress: string;
  fromName?: string;
}

/**
 * HTTP-API email delivery via Brevo's transactional email endpoint.
 *
 * Added during production QA (2026-07-29) after confirming, via Render's
 * own changelog, that free-tier web services block ALL outbound traffic to
 * SMTP ports 25/465/587:
 * https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports
 * That made SmtpClient/SmtpEmailService permanently unusable from this
 * deployment no matter how correct SMTP_HOST/PORT/USERNAME/PASSWORD are --
 * live logs showed the raw TCP connect itself failing (ETIMEDOUT on the
 * IPv4 route, ENETUNREACH on the IPv6 route) before a single byte of SMTP
 * was ever exchanged.
 *
 * Brevo's send API is plain HTTPS (port 443), which is not affected by
 * that block -- the same "no SDK, just fetch" approach already used for
 * TwilioSmsService/GoogleGeocodingService. It's also one of the few
 * transactional-email providers whose sender verification only requires
 * proving control of a single email address (a confirmation link sent to
 * that address), not owning a domain with SPF/DKIM records -- which fits
 * this deployment, since it runs on Render's own onrender.com subdomains
 * rather than a custom domain the team controls DNS for.
 *
 * container.ts prefers this over SmtpEmailService whenever BREVO_API_KEY
 * is set, so local development (where outbound SMTP isn't blocked) can
 * still use real Gmail SMTP unchanged, while the Render deployment uses
 * this instead.
 */
export class BrevoEmailService implements IEmailService {
  constructor(private readonly config: BrevoConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: this.config.fromAddress, name: this.config.fromName ?? "RentIt" },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    if (!response.ok) {
      // Brevo returns a JSON body like {"code":"...","message":"..."} on
      // failure (e.g. unverified sender, invalid key) -- surface it
      // verbatim rather than just the HTTP status, since that message is
      // usually specific enough to fix without needing to reproduce here.
      const detail = await response.text();
      throw new Error(`Brevo email send failed with HTTP ${response.status}: ${detail}`);
    }
  }
}
