import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

// Fail closed on anything that isn't explicitly "development" -- an exact
// `isProduction` check here would silently let the hardcoded fallback
// secret below sign real tokens whenever NODE_ENV is unset, mistyped, or
// set to something like "staging" that a deploy target forgot to map to
// "production". "development" is the only environment where booting
// without a real secret is intentional.
if (nodeEnv !== "development" && !process.env.JWT_ACCESS_SECRET) {
  throw new Error(
    `JWT_ACCESS_SECRET must be set when NODE_ENV is not "development" (got: "${nodeEnv}")`,
  );
}

// Webhook secrets are deliberately NOT fail-closed at startup (unlike the
// JWT guard above) -- RentIt needs to be able to run in production before
// a real Razorpay/Stripe account exists, and neither provider's webhook
// secret is required for the rest of the app to function (only for that
// one provider's webhook endpoint). The security property this used to
// enforce -- never accept a webhook signed against an empty-string secret
// -- is instead enforced at the point of use: container.ts only wires up
// a provider's webhook handler (HandlePaymentWebhookUseCase) when that
// provider's secret is actually configured; WebhookController returns 503
// for the other one instead of ever calling verifyWebhookSignature() with
// an empty secret. See env.razorpay.webhookSecretConfigured /
// env.stripe.webhookSecretConfigured below and WebhookController.ts.

export const env = {
  nodeEnv,
  isProduction,
  // Dedicated override for OtpIssuer's SMS bypass (see AuthConfig.devOtpMode
  // and OtpIssuer.ts) -- deliberately NOT derived from isProduction/nodeEnv.
  // Render sets NODE_ENV=production on deployed web services regardless of
  // whether a real, DLT-registered Twilio account is configured, so an
  // isProduction-based check stayed permanently on the "call Twilio" branch
  // in the one environment (this Render deployment, no DLT registration
  // yet) where the bypass was actually needed. This flag is opt-in and
  // false by default, so a normal production deploy with a real Twilio
  // account is completely unaffected unless someone explicitly sets it.
  devOtpMode: process.env.DEV_OTP_MODE === "true",
  port: int("PORT", 4000),
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://rentit:rentit_dev_password@localhost:5432/rentit",
  ),
  // Opt-in TLS for the shared pg Pool (database.ts). Off by default, which
  // preserves the deployed app's behavior exactly -- it connects over
  // Render's private network via the Internal Database URL and has never
  // needed this. It only needs to be true for a connection that crosses
  // the public internet to a managed Postgres provider that requires SSL
  // there, e.g. pointing DATABASE_URL at Render's *External* Database URL
  // -- which is exactly what scripts/bootstrap-admin.ts has to do when run
  // from outside Render (see docs/ADMIN_BOOTSTRAP.md). Without this, `pg`
  // never attempts SSL and the server rejects the connection with
  // "SSL/TLS required".
  databaseSsl: process.env.DATABASE_SSL === "true",
  // Comma-separated list of allowed browser origins. Defaults to both
  // Vite dev ports: Vite tries 5173 first but silently falls forward to
  // 5174 (and beyond) whenever 5173 is already taken, with no code change
  // needed on the frontend side -- if this only allowed 5173, every
  // request from a 5174-served dev frontend would be silently rejected
  // by the browser's CORS check (no console-visible backend error, just
  // failed fetches), which is exactly the kind of "works on my machine
  // sometimes" bug this list is meant to prevent. `cors` accepts an array
  // of allowed origins natively.
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),

  jwt: {
    // Dev-only fallback so the app boots without extra setup; production
    // requires a real secret (enforced above).
    accessSecret: required("JWT_ACCESS_SECRET", "dev-only-insecure-secret-change-me"),
    accessTokenTtlSeconds: int("JWT_ACCESS_TOKEN_TTL_SECONDS", 900),
    issuer: process.env.JWT_ISSUER ?? "rentit",
    audience: process.env.JWT_AUDIENCE ?? "rentit-clients",
  },

  refreshTokenTtlSeconds: int("REFRESH_TOKEN_TTL_SECONDS", 2592000),

  bcryptSaltRounds: int("BCRYPT_SALT_ROUNDS", 12),

  otp: {
    length: int("OTP_LENGTH", 6),
    ttlSeconds: int("OTP_TTL_SECONDS", 300),
    maxAttempts: int("OTP_MAX_ATTEMPTS", 5),
  },

  rateLimit: {
    authWindowMs: int("RATE_LIMIT_AUTH_WINDOW_MS", 900000),
    authMax: int("RATE_LIMIT_AUTH_MAX", 10),
    // Added during the production-readiness audit: chat messages and
    // WhatsApp actions (contact-owner/inquiry/share) had no rate limiting
    // at all -- share() in particular is unauthenticated, so an unlimited
    // endpoint could be used to spam arbitrary phone numbers or run up
    // provider costs. Generous defaults for real usage, cheap to lower.
    messagingWindowMs: int("RATE_LIMIT_MESSAGING_WINDOW_MS", 60_000),
    messagingMax: int("RATE_LIMIT_MESSAGING_MAX", 20),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  // Google Maps Geocoding was removed 2026-07-29 in favor of Nominatim
  // (OpenStreetMap) -- see NominatimGeocodingService, which needs no API
  // key at all. No env var replaces this one.
  maxImageUploadBytes: int("MAX_IMAGE_UPLOAD_BYTES", 10 * 1024 * 1024),

  // --- Phase 5 ---

  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? "http://localhost:5173",

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: int("SMTP_PORT", 587),
    secure: process.env.SMTP_SECURE === "true",
    username: process.env.SMTP_USERNAME ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    fromAddress: process.env.SMTP_FROM_ADDRESS ?? "no-reply@rentit.example",
  },

  // HTTP-API email fallback (BrevoEmailService) -- see that file's doc
  // comment. Empty by default so nothing changes for local dev/anyone
  // already relying on real SMTP; container.ts only switches to Brevo when
  // this is set, which it must be for any Render free-tier deployment
  // since that plan blocks outbound SMTP entirely.
  brevo: {
    apiKey: process.env.BREVO_API_KEY ?? "",
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    // Escaped newlines are how service-account keys survive being pasted
    // into a single-line .env value.
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },

  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  },

  // --- Phase 6 Part 1: Payments ---

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    // Drives container.ts's decision to wire up (or safely disable) the
    // Razorpay webhook handler -- see the comment above the guards.
    webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  },

  payments: {
    currency: process.env.PAYMENT_CURRENCY ?? "INR",
    // Amounts are the smallest currency unit (paise for INR) -- defaults
    // below are illustrative; change per real pricing decisions.
    featuredListingPriceAmount: int("FEATURED_LISTING_PRICE_AMOUNT", 19900),
    featuredListingDurationDays: int("FEATURED_LISTING_DURATION_DAYS", 7),
    boostListingPriceAmount: int("BOOST_LISTING_PRICE_AMOUNT", 9900),
    boostListingDurationDays: int("BOOST_LISTING_DURATION_DAYS", 3),
  },

  rateLimitWebhook: {
    windowMs: int("RATE_LIMIT_WEBHOOK_WINDOW_MS", 60_000),
    max: int("RATE_LIMIT_WEBHOOK_MAX", 120),
  },

  // Added during the Phase 6 Part 2 security audit -- see rateLimiter.ts's
  // createPaymentOrderRateLimiter doc comment.
  rateLimitPaymentOrder: {
    windowMs: int("RATE_LIMIT_PAYMENT_ORDER_WINDOW_MS", 600_000),
    max: int("RATE_LIMIT_PAYMENT_ORDER_MAX", 10),
  },

  // --- Phase 6 Part 4: Observability ---

  sentry: {
    // Empty by default -> container.ts wires up NoOpErrorTracker instead
    // of SentryErrorTracker. Setting this is the only step needed to turn
    // on real error reporting; no code change required.
    dsn: process.env.SENTRY_DSN ?? "",
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version ?? "unknown",
  },

  // Shared secret required in the Authorization header of GET /metrics --
  // Prometheus scrape configs support `bearer_token`/`bearer_token_file`
  // natively. Metrics expose route-level request-rate data that shouldn't
  // be public on the open internet.
  metricsToken: process.env.METRICS_TOKEN ?? "",
} as const;
