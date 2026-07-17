export type BoostType = "featured" | "boost";
export type ListingBoostStatus = "pending" | "active" | "expired" | "cancelled";

export interface ListingBoost {
  id: string;
  propertyId: string;
  userId: string;
  boostType: BoostType;
  status: ListingBoostStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
