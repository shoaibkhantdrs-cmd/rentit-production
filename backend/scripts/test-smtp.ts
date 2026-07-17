/**
 * Standalone SMTP verification script -- sends one real email through the
 * exact same SmtpEmailService/SmtpClient code path OtpIssuer uses in
 * production, without needing the full app running or a database
 * connection. Use this to confirm Gmail SMTP is configured correctly
 * before testing the actual "send me an OTP" flow through the UI.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-smtp.ts you@example.com
 * or, once added to package.json:
 *   npm run test:smtp -- you@example.com
 */
import { env } from "@/config/env";
import { SmtpEmailService } from "@/infrastructure/email/SmtpEmailService";

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx tsx scripts/test-smtp.ts <recipient-email>");
    process.exit(1);
  }

  if (!env.smtp.host || !env.smtp.username || !env.smtp.password) {
    console.error(
      "SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD are not all set in backend/.env -- " +
        "fill those in first (see backend/.env.example's SMTP section).",
    );
    process.exit(1);
  }

  console.log(
    `Connecting to ${env.smtp.host}:${env.smtp.port} (secure=${env.smtp.secure}) as ${env.smtp.username} ...`,
  );
  console.log(`Sending from ${env.smtp.fromAddress} to ${to} ...`);

  if (env.smtp.fromAddress !== env.smtp.username) {
    console.warn(
      `WARNING: SMTP_FROM_ADDRESS ("${env.smtp.fromAddress}") does not match SMTP_USERNAME ` +
        `("${env.smtp.username}"). Gmail requires the From address to be the authenticated ` +
        "account itself, or a verified 'Send As' alias configured in Gmail Settings -> Accounts " +
        "-> \"Send mail as\". Otherwise Gmail will reject or silently drop this message.",
    );
  }

  const service = new SmtpEmailService(env.smtp);

  await service.send({
    to,
    subject: "RentIt SMTP test -- this proves OTP emails will send",
    text:
      "This is a real test email sent by RentIt's SmtpClient (the same code path OTP, " +
      "welcome, and password-reset emails use) to confirm Gmail SMTP is configured correctly.",
    html:
      "<p>This is a real test email sent by RentIt's <code>SmtpClient</code> (the same code " +
      "path OTP, welcome, and password-reset emails use) to confirm Gmail SMTP is configured " +
      "correctly.</p>",
  });

  console.log(`Sent successfully. Check the inbox (and spam folder) for: ${to}`);
}

main().catch((err: Error) => {
  console.error("SMTP test FAILED:", err.message);
  console.error(
    "Common causes: SMTP_PASSWORD is your real Gmail password instead of an App Password " +
      "(Google rejects this outright); 2-Step Verification isn't enabled on the Google account " +
      "(required before an App Password can even be generated); or SMTP_HOST/PORT are wrong.",
  );
  process.exit(1);
});
