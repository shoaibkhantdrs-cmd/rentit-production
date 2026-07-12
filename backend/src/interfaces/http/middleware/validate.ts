import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ValidationError } from "@/domain/errors/AppError";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(new ValidationError("Validation failed", result.error.flatten()));
      return;
    }

    // Replaced (not merged) so defaults/coercions from the schema apply.
    (req as unknown as Record<RequestPart, unknown>)[part] = result.data;
    next();
  };
}
