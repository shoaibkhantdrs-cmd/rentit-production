import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://rentit:rentit_dev_password@localhost:5432/rentit",
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
} as const;
