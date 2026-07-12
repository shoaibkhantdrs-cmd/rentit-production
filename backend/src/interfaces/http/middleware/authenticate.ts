import { NextFunction, Request, Response } from "express";
import { ITokenService } from "@/domain/services/ITokenService";
import { UnauthorizedError } from "@/domain/errors/AppError";

export function authenticate(tokenService: ITokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header("authorization");

    if (!header || !header.startsWith("Bearer ")) {
      next(new UnauthorizedError("Missing or malformed Authorization header"));
      return;
    }

    const token = header.slice("Bearer ".length).trim();

    try {
      req.user = tokenService.verifyAccessToken(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
