import { Session } from "@/domain/entities/Session";

export interface NewSessionInput {
  userId: string;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}

export interface ISessionRepository {
  create(input: NewSessionInput): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  touchLastActive(id: string): Promise<void>;
  revoke(id: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string, exceptSessionId?: string): Promise<number>;
}
