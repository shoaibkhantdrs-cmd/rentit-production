import { ISessionRepository, NewSessionInput } from "@/domain/repositories/ISessionRepository";
import { Session } from "@/domain/entities/Session";
import { newId } from "./ids";

export class InMemorySessionRepository implements ISessionRepository {
  public readonly sessions = new Map<string, Session>();

  async create(input: NewSessionInput): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: newId(),
      userId: input.userId,
      deviceId: input.deviceId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedReason: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async touchLastActive(id: string): Promise<void> {
    const existing = this.sessions.get(id);
    if (!existing) return;
    this.sessions.set(id, { ...existing, lastActiveAt: new Date(), updatedAt: new Date() });
  }

  async revoke(id: string, reason: string): Promise<void> {
    const existing = this.sessions.get(id);
    if (!existing || existing.revokedAt) return;
    this.sessions.set(id, {
      ...existing,
      revokedAt: new Date(),
      revokedReason: reason,
      updatedAt: new Date(),
    });
  }

  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt && session.id !== exceptSessionId) {
        this.sessions.set(session.id, {
          ...session,
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
