import { EmailMessage } from "@/domain/services/IEmailService";

/**
 * Phase 5 Part 3 ("Support: ... Welcome email, ... Property approval
 * email"). OTP and password-reset emails already exist as of Phase 2 (via
 * OtpIssuer/ResetPasswordUseCase + INotificationSender) and aren't
 * duplicated here -- these are pure functions precisely so the two new
 * email kinds slot into the same INotificationSender/IEmailService pipe
 * without every use-case re-inventing its own HTML.
 */
function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, Arial, sans-serif; background:#f5f5f5; padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;">
      <h2 style="color:#1a1a1a;">${title}</h2>
      ${bodyHtml}
      <p style="color:#888;font-size:12px;margin-top:32px;">RentIt &middot; this is an automated message.</p>
    </div>
  </body>
</html>`;
}

export function buildWelcomeEmail(to: string, name: string): EmailMessage {
  const subject = "Welcome to RentIt";
  const text = `Hi ${name},\n\nWelcome to RentIt! Your account is ready. Start browsing listings or list your own property whenever you're ready.\n\n- The RentIt team`;
  const html = wrap(
    subject,
    `<p>Hi ${name},</p><p>Welcome to RentIt! Your account is ready. Start browsing listings or list your own property whenever you're ready.</p>`,
  );
  return { to, subject, text, html };
}

export function buildPropertyApprovalEmail(to: string, ownerName: string, propertyTitle: string): EmailMessage {
  const subject = "Your listing has been approved";
  const text = `Hi ${ownerName},\n\nGreat news -- "${propertyTitle}" has been reviewed and approved. It's now live and visible to renters.\n\n- The RentIt team`;
  const html = wrap(
    subject,
    `<p>Hi ${ownerName},</p><p>Great news -- <strong>${propertyTitle}</strong> has been reviewed and approved. It's now live and visible to renters.</p>`,
  );
  return { to, subject, text, html };
}
