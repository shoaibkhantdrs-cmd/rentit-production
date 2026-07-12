export interface RefreshToken {
  id: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  familyId: string;
  replacedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}
