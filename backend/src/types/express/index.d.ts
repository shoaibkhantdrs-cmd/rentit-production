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
    }
  }
}

export {};
