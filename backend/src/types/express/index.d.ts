import { AccessTokenClaims } from "@/domain/services/ITokenService";

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AccessTokenClaims;
      deviceContext: {
        deviceId: string;
        platform: "web" | "ios" | "android" | "unknown";
        userAgent: string | null;
        ipAddress: string | null;
      };
      /**
       * Raw request body bytes, captured by express.json()'s verify hook in
       * app.ts. Payment webhook signature verification (Phase 6 Part 1)
       * MUST check the signature against these exact bytes -- re-serializing
       * the parsed JSON body can produce a byte-different string (key
       * order, whitespace, unicode escaping) that fails a signature the
       * gateway computed against the original bytes. Undefined for
       * requests with an empty body.
       */
      rawBody?: Buffer;
    }
  }
}

export {};
