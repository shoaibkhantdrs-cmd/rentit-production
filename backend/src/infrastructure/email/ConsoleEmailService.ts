import { EmailMessage, IEmailService } from "@/domain/services/IEmailService";
import { logger } from "@/infrastructure/logging/logger";

// ANSI codes, applied directly (not via a dependency) since this is a tiny,
// dev-only, zero-risk cosmetic touch -- no need to pull in chalk/picocolors
// for four escape sequences.
const BOLD = "\x1b[1m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

/**
 * OtpIssuer's email body is a plain sentence -- "Your code to log in is
 * 483920. It expires in 10 minutes..." -- because EmailMessage is a
 * generic, production-shaped interface (same shape SmtpEmailService uses
 * for the real Gmail send) that has no dedicated "otp code" field to keep
 * clean. For local dev, pulling the run of digits back out of that
 * sentence and printing it on its own line is purely a readability
 * convenience: it doesn't change what's sent, only how legible it is here.
 */
function extractOtpCode(text: string): string | null {
  const match = text.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

/** Same honest-stub pattern as ConsoleNotificationSender/
 * ConsolePushNotificationService: a real, working IEmailService that logs
 * instead of dialing an SMTP server. Bound by container.ts when SMTP_HOST
 * isn't configured, so local development and this sandbox never need a
 * real mail server to exercise every email-sending code path. */
export class ConsoleEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<void> {
    const otpCode = extractOtpCode(message.text);

    console.log("");
    console.log(`${CYAN}${BOLD}==================== DEV EMAIL ====================${RESET}`);
    console.log(`${CYAN}TO:${RESET}      ${message.to}`);
    console.log(`${CYAN}SUBJECT:${RESET} ${message.subject}`);
    if (otpCode) {
      console.log(`${CYAN}OTP CODE:${RESET} ${YELLOW}${BOLD}${otpCode}${RESET}`);
    }
    console.log(`${CYAN}BODY:${RESET}    ${message.text}`);
    console.log(`${CYAN}${BOLD}====================================================${RESET}`);
    console.log("");

    logger.info(
      { to: message.to, subject: message.subject, otpCode },
      `[dev-email] ${message.text}`,
    );
  }
}
