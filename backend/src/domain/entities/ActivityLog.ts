export interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
