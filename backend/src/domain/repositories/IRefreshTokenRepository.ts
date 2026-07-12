import { RefreshToken } from "@/domain/entities/RefreshToken";

export interface NewRefreshTokenInput {
  userId: string;
  sessionId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface IRefreshTokenRepository {
  create(input: NewRefreshTokenInput): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  markReplaced(id: string, replacedById: string): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
  revokeFamily(familyId: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string): Promise<number>;
}
