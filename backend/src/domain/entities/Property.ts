export type PropertyType =
  | "apartment"
  | "house"
  | "villa"
  | "studio"
  | "pg"
  | "room"
  | "commercial"
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
  Partial<Pick<Property, "floorNumber" | "totalFloors" | "facing">>;

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
}
