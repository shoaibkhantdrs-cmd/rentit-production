import {
  IRefreshTokenRepository,
  NewRefreshTokenInput,
} from "@/domain/repositories/IRefreshTokenRepository";
import { RefreshToken } from "@/domain/entities/RefreshToken";
import { newId } from "./ids";

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  public readonly tokens = new Map<string, RefreshToken>();

  async create(input: NewRefreshTokenInput): Promise<RefreshToken> {
    const now = new Date();
    const token: RefreshToken = {
      id: newId(),
      userId: input.userId,
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      replacedBy: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedReason: null,
    };
    this.tokens.set(token.id, token);
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    for (const token of this.tokens.values()) {
      if (token.tokenHash === tokenHash) return token;
    }
    return null;
  }

  async markReplaced(id: string, replacedById: string): Promise<void> {
    const existing = this.tokens.get(id);
    if (!existing) return;
    this.tokens.set(id, { ...existing, replacedBy: replacedById, updatedAt: new Date() });
  }

  async revoke(id: string, reason: string): Promise<void> {
    const existing = this.tokens.get(id);
    if (!existing || existing.revokedAt) return;
    this.tokens.set(id, {
      ...existing,
      revokedAt: new Date(),
      revokedReason: reason,
      updatedAt: new Date(),
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.familyId === familyId && !token.revokedAt) {
        this.tokens.set(token.id, {
          ...token,
          revokedAt: new Date(),
          revokedReason: reason,
          updatedAt: new Date(),
        });
      }
    }
  }

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    let count = 0;
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.revokedAt) {
        this.tokens.set(token.id, {
          ...token,
          revokedAt: new Date(),
          revokedReason: reason,
          updatedAt: new Date(),
        });
        count += 1;
      }
    }
    return count;
  }
}
