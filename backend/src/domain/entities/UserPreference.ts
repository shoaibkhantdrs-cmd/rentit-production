export interface UserPreference {
  id: string;
  userId: string;
  language: string;
  timezone: string;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  extra: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
