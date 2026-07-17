import { Router } from "express";
import { getHealth, getLiveness } from "@/controllers/health.controller";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
// Phase 6 Part 4: liveness check, separate from the DB-backed readiness
// check above -- see getLiveness()'s doc comment for why these must stay
// two different endpoints rather than one.
healthRouter.get("/live", getLiveness);
