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

if (isProduction && !process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be set in production");
}

export const env = {
  nodeEnv,
  isProduction,
  port: int("PORT", 4000),
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://rentit:rentit_dev_password@localhost:5432/rentit",
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
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
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",

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
} as const;
