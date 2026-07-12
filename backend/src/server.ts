import { createApp } from "@/app";
import { env } from "@/config/env";
import { pool } from "@/config/database";
import { logger } from "@/infrastructure/logging/logger";

const { app, container } = createApp();

const server = app.listen(env.port, () => {
  logger.info(`RentIt backend listening on port ${env.port} (${env.nodeEnv})`);
});

// Phase 5 Part 1 (Real-time Chat): the WebSocket gateway shares this same
// http.Server via the 'upgrade' event, so chat connects on the same host
// and port as the REST API (ws://.../ws/chat?token=...) rather than a
// separate listener.
container.realtimeGateway.attach(server);

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    logger.info("Shutdown complete");
    process.exit(0);
  });

  // Don't hang forever if something (a stuck connection) prevents a clean close.
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
