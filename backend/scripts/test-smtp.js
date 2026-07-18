"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const env_1 = require("@/config/env");
const SmtpEmailService_1 = require("@/infrastructure/email/SmtpEmailService");
async function main() {
    const to = process.argv[2];
    if (!to) {
        console.error("Usage: npx tsx scripts/test-smtp.ts <recipient-email>");
        process.exit(1);
    }
    if (!env_1.env.smtp.host || !env_1.env.smtp.username || !env_1.env.smtp.password) {
        console.error("SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD are not all set in backend/.env -- " +
            "fill those in first (see backend/.env.example's SMTP section).");
        process.exit(1);
    }
    console.log(`Connecting to ${env_1.env.smtp.host}:${env_1.env.smtp.port} (secure=${env_1.env.smtp.secure}) as ${env_1.env.smtp.username} ...`);
    console.log(`Sending from ${env_1.env.smtp.fromAddress} to ${to} ...`);
    if (env_1.env.smtp.fromAddress !== env_1.env.smtp.username) {
        console.warn(`WARNING: SMTP_FROM_ADDRESS ("${env_1.env.smtp.fromAddress}") does not match SMTP_USERNAME ` +
            `("${env_1.env.smtp.username}"). Gmail requires the From address to be the authenticated ` +
            "account itself, or a verified 'Send As' alias configured in Gmail Settings -> Accounts " +
            "-> \"Send mail as\". Otherwise Gmail will reject or silently drop this message.");
    }
    const service = new SmtpEmailService_1.SmtpEmailService(env_1.env.smtp);
    await service.send({
        to,
        subject: "RentIt SMTP test -- this proves OTP emails will send",
        text: "This is a real test email sent by RentIt's SmtpClient (the same code path OTP, " +
            "welcome, and password-reset emails use) to confirm Gmail SMTP is configured correctly.",
        html: "<p>This is a real test email sent by RentIt's <code>SmtpClient</code> (the same code " +
            "path OTP, welcome, and password-reset emails use) to confirm Gmail SMTP is configured " +
            "correctly.</p>",
    });
    console.log(`Sent successfully. Check the inbox (and spam folder) for: ${to}`);
}
main().catch((err) => {
    console.error("SMTP test FAILED:", err.message);
    console.error("Common causes: SMTP_PASSWORD is your real Gmail password instead of an App Password " +
        "(Google rejects this outright); 2-Step Verification isn't enabled on the Google account " +
        "(required before an App Password can even be generated); or SMTP_HOST/PORT are wrong.");
    process.exit(1);
});
