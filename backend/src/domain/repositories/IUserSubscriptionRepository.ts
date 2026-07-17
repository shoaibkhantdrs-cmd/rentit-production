import { UserSubscription, UserSubscriptionStatus } from "@/domain/entities/UserSubscription";

export interface NewUserSubscriptionInput {
  userId: string;
  planId: string;
}

export interface IUserSubscriptionRepository {
  create(input: NewUserSubscriptionInput): Promise<UserSubscription>;
  findById(id: string): Promise<UserSubscription | null>;
  activate(id: string, startsAt: Date, endsAt: Date): Promise<UserSubscription>;
  updateStatus(id: string, status: UserSubscriptionStatus): Promise<UserSubscription>;
  findActiveForUser(userId: string): Promise<UserSubscription | null>;
  listForUser(userId: string): Promise<UserSubscription[]>;
}
