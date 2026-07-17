import { BoostType, ListingBoost, ListingBoostStatus } from "@/domain/entities/ListingBoost";

export interface NewListingBoostInput {
  propertyId: string;
  userId: string;
  boostType: BoostType;
}

export interface IListingBoostRepository {
  create(input: NewListingBoostInput): Promise<ListingBoost>;
  findById(id: string): Promise<ListingBoost | null>;
  activate(id: string, startsAt: Date, endsAt: Date): Promise<ListingBoost>;
  updateStatus(id: string, status: ListingBoostStatus): Promise<ListingBoost>;
  /** Property ids with a currently-active boost of the given type, for search ranking. */
  listActivePropertyIds(boostType: BoostType): Promise<string[]>;
  listForUser(userId: string): Promise<ListingBoost[]>;
}
