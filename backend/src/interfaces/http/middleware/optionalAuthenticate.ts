import { NextFunction, Request, Response } from "express";
import { ITokenService } from "@/domain/services/ITokenService";

/**
 * Like authenticate(), but a missing or invalid token is not an error --
 * req.user is simply left unset and the request proceeds as anonymous.
 * Used by endpoints that behave differently for logged-in users (e.g. is
 * this listing already in my favorites?) without requiring a login.
 */
export function optionalAuthenticate(tokenService: ITokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header("authorization");

    if (!header || !header.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = header.slice("Bearer ".length).trim();

    try {
      req.user = tokenService.verifyAccessToken(token);
    } catch {
      // Invalid/expired token on an optional-auth route: treat as anonymous
      // rather than rejecting the request.
    }
    next();
  };
}
