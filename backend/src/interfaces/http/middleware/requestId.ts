import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.id = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}
