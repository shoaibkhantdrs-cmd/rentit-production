// Superseded by src/infrastructure/logging/logger.ts (pino) in Phase 2.
// Kept as a re-export (rather than deleted) because this sandbox's output
// folder does not allow removing previously-written files -- see
// docs/phase-2.md "Folder changes" for the full explanation.
export { logger } from "@/infrastructure/logging/logger";
