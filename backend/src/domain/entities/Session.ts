export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}
