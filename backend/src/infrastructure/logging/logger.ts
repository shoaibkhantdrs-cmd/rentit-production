import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.logLevel,
  transport: env.isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
  redact: {
    // Never let request/response logging leak credentials or tokens.
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.newPassword",
      "*.code",
      "*.refreshToken",
      "*.accessToken",
    ],
    censor: "[REDACTED]",
  },
});
