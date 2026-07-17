# Phase 6 Part 8 — Deployment Guide: SMTP (Email)

For dev setup (e.g. a personal Gmail SMTP or a local mail-catcher), see root `docs/phase-5.md` "Provider setup guide." This covers what production needs beyond "point `SmtpEmailService` at a working SMTP server."

## Choosing a production SMTP provider

A personal email account's SMTP (Gmail, Outlook, etc.) is fine for development but wrong for production: low sending-volume limits, a real risk of the account getting flagged/suspended for "unusual activity" once it's sending transactional email at any real volume, and no real deliverability tooling. Use a transactional email provider instead — SendGrid, Postmark, Amazon SES, or Mailgun are the common choices; any of them work as a drop-in `SMTP_HOST`/`SMTP_PORT`/`SMTP_USERNAME`/`SMTP_PASSWORD` swap with zero code change, since `SmtpEmailService` already speaks plain SMTP rather than a provider-specific API/SDK. Amazon SES is typically the cheapest at scale if already on AWS; Postmark is often the best out-of-the-box deliverability reputation for transactional (non-marketing) mail, which is what this app sends (verification codes, notifications) — either is a reasonable default.

## Domain authentication (SPF, DKIM, DMARC)

This is the single most impactful production change and has nothing to do with this codebase's code — it's DNS records on the sending domain (`SMTP_FROM_ADDRESS`'s domain, e.g. `example.com` for `no-reply@example.com`):

- **SPF**: a DNS TXT record listing which mail servers are allowed to send as your domain — the chosen provider's setup docs give the exact record to add.
- **DKIM**: the provider generates a public/private keypair; the public key goes in a DNS TXT record, and the provider signs outgoing mail with the private key so receiving mail servers can verify it wasn't forged.
- **DMARC**: a policy DNS record telling receiving mail servers what to do with mail that fails SPF/DKIM (quarantine, reject, or just report) — start with a monitoring-only policy (`p=none`) and tighten it once confident SPF/DKIM are correctly passing for all real mail.

Without these, verification-code and notification emails from this app are meaningfully more likely to land in spam or be rejected outright by major providers (Gmail/Outlook/Yahoo) — this matters immediately for this app specifically, since account registration depends on a verification email actually arriving.

## `SMTP_SECURE` and port

`.env.production.example` sets `SMTP_SECURE=true` (vs. `false` in dev) — most providers expect implicit TLS on port 465 (`SMTP_SECURE=true`) or STARTTLS on port 587 (`SMTP_SECURE=false` with the STARTTLS upgrade happening after connect); confirm which combination the chosen provider documents and match `SMTP_PORT`/`SMTP_SECURE` accordingly rather than assuming one is universally correct.

## Sending reputation

Transactional providers (SendGrid/Postmark/SES) also give bounce/complaint webhooks and sender-reputation dashboards that plain SMTP through a personal account never did — worth wiring into the existing observability stack (Part 4) if email delivery failures should show up as an operational metric rather than only being discoverable by a user complaining they never got a verification code.
