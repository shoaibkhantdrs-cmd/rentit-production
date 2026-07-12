import { NextFunction, Request, Response } from "express";

export function notFound(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}
