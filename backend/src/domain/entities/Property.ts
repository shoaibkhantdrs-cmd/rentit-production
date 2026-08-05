export type PropertyType =
  | "apartment"
  | "house"
  | "villa"
  | "studio"
  | "pg"
  | "room"
  | "commercial"
  | "shop"
  | "other";

export type PropertyStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rented"
  | "inactive"
  | "removed"
  | "rejected";

export type Facing =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north_east"
  | "north_west"
  | "south_east"
  | "south_west";

export type FurnishedStatus = "unfurnished" | "semi_furnished" | "fully_furnished";

export interface Property {
  id: string;
  ownerId: string;
  categoryId: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorNumber: number | null;
  totalFloors: number | null;
  facing: Facing | null;
  furnishedStatus: FurnishedStatus;
  availableFrom: string; // ISO date (YYYY-MM-DD)
  viewCount: number;
  favoriteCount: number;
  publishedAt: Date | null;
  /** Phase 4 (Admin/Moderation) additions -- all additive to the Phase 3 shape. */
  isFeatured: boolean;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  rejectionReason: string | null;
  /**
   * Phase 2 Part 2 (Shop Listing UI): shop-specific measurements/amenities.
   * Always present (never `undefined`) but null for every non-shop listing
   * (and for a shop listing where the owner left an optional field blank) --
   * "Shop Carpet Area" and "Floor" deliberately reuse the existing
   * `areaSqft`/`floorNumber` fields above instead of duplicating them here.
   */
  frontWidthFt: number | null;
  shopDepthFt: number | null;
  roadWidthFt: number | null;
  powerLoad: string | null;
  isCornerShop: boolean | null;
  hasWashroom: boolean | null;
  readyToMove: boolean | null;
  suitableFor: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type NewProperty = Pick<
  Property,
  | "ownerId"
  | "categoryId"
  | "title"
  | "description"
  | "propertyType"
  | "rentAmount"
  | "securityDeposit"
  | "areaSqft"
  | "bedrooms"
  | "bathrooms"
  | "parkingSpaces"
  | "furnishedStatus"
  | "availableFrom"
> &
  Partial<
    Pick<
      Property,
      | "floorNumber"
      | "totalFloors"
      | "facing"
      | "frontWidthFt"
      | "shopDepthFt"
      | "roadWidthFt"
      | "powerLoad"
      | "isCornerShop"
      | "hasWashroom"
      | "readyToMove"
      | "suitableFor"
    >
  >;

export interface PropertyUpdatePatch {
  title?: string;
  description?: string;
  categoryId?: string;
  propertyType?: PropertyType;
  rentAmount?: number;
  securityDeposit?: number;
  areaSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  floorNumber?: number | null;
  totalFloors?: number | null;
  facing?: Facing | null;
  furnishedStatus?: FurnishedStatus;
  availableFrom?: string;
  status?: PropertyStatus;
  viewCount?: number;
  favoriteCount?: number;
  publishedAt?: Date | null;
  isFeatured?: boolean;
  moderatedBy?: string | null;
  moderatedAt?: Date | null;
  rejectionReason?: string | null;
  frontWidthFt?: number | null;
  shopDepthFt?: number | null;
  roadWidthFt?: number | null;
  powerLoad?: string | null;
  isCornerShop?: boolean | null;
  hasWashroom?: boolean | null;
  readyToMove?: boolean | null;
  suitableFor?: string[] | null;
}
