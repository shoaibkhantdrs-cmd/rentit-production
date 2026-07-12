export interface AccessTokenClaims {
  sub: string; // user id
  roles: string[];
  sessionId: string;
}

export interface VerifiedAccessToken extends AccessTokenClaims {
  iat: number;
  exp: number;
}

export interface ITokenService {
  signAccessToken(claims: AccessTokenClaims): string;
  /** Throws UnauthorizedError (via domain errors) on invalid/expired/tampered tokens. */
  verifyAccessToken(token: string): VerifiedAccessToken;
  /** High-entropy opaque string; never a JWT (see docs/phase-2.md for why). */
  generateOpaqueToken(): string;
  hashOpaqueToken(token: string): string;
}
