export type UserSubscriptionStatus = "pending" | "active" | "expired" | "cancelled";

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: UserSubscriptionStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
