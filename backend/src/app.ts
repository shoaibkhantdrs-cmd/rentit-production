import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@/config/env";
import { healthRouter } from "@/routes/health.routes";
import { notFound } from "@/middleware/notFound";
import { errorHandler } from "@/middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  app.use("/health", healthRouter);

  // Feature routes are mounted here in later phases, e.g.:
  // app.use("/api/listings", listingsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
