import { z } from "zod";
import { PROPERTY_FEATURE_KEYS } from "@/domain/entities/PropertyFeature";

const propertyTypeEnum = z.enum([
  "apartment",
  "house",
  "villa",
  "studio",
  "pg",
  "room",
  "commercial",
  "other",
]);

const facingEnum = z.enum([
  "north",
  "south",
  "east",
  "west",
  "north_east",
  "north_west",
  "south_east",
  "south_west",
]);

const furnishedStatusEnum = z.enum(["unfurnished", "semi_furnished", "fully_furnished"]);
const statusEnum = z.enum(["draft", "pending_review", "published", "rented", "inactive", "removed"]);
const featureKeyEnum = z.enum(PROPERTY_FEATURE_KEYS);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

const locationSchema = z.object({
  addressLine: z.string().min(5).max(300),
  city: z.string().min(2).max(120),
  locality: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const createPropertySchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  categoryId: z.string().uuid(),
  propertyType: propertyTypeEnum,
  rentAmount: z.number().min(0),
  securityDeposit: z.number().min(0).default(0),
  areaSqft: z.number().positive(),
  bedrooms: z.number().int().min(0).default(0),
  bathrooms: z.number().int().min(0).default(0),
  parkingSpaces: z.number().int().min(0).default(0),
  floorNumber: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  facing: facingEnum.optional(),
  furnishedStatus: furnishedStatusEnum.default("unfurnished"),
  availableFrom: dateOnly,
  features: z.array(featureKeyEnum).max(20).optional(),
  location: locationSchema,
});

export const updatePropertySchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  propertyType: propertyTypeEnum.optional(),
  status: statusEnum.optional(),
  rentAmount: z.number().min(0).optional(),
  securityDeposit: z.number().min(0).optional(),
  areaSqft: z.number().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  parkingSpaces: z.number().int().min(0).optional(),
  floorNumber: z.number().int().nullable().optional(),
  totalFloors: z.number().int().nullable().optional(),
  facing: facingEnum.nullable().optional(),
  furnishedStatus: furnishedStatusEnum.optional(),
  availableFrom: dateOnly.optional(),
  features: z.array(featureKeyEnum).max(20).optional(),
  location: locationSchema.partial().optional(),
});

export const searchPropertiesQuerySchema = z.object({
  category: z.string().max(100).optional(),
  propertyType: propertyTypeEnum.optional(),
  rentMin: z.coerce.number().min(0).optional(),
  rentMax: z.coerce.number().min(0).optional(),
  bedroomsMin: z.coerce.number().int().min(0).optional(),
  bathroomsMin: z.coerce.number().int().min(0).optional(),
  parkingMin: z.coerce.number().int().min(0).optional(),
  areaMin: z.coerce.number().min(0).optional(),
  areaMax: z.coerce.number().min(0).optional(),
  city: z.string().max(120).optional(),
  locality: z.string().max(120).optional(),
  furnished: furnishedStatusEnum.optional(),
  availableFrom: dateOnly.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  sort: z.enum(["newest", "most_viewed", "price_low_to_high", "price_high_to_low"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const reportPropertySchema = z.object({
  reason: z.enum([
    "spam",
    "fraud",
    "incorrect_information",
    "duplicate_listing",
    "offensive_content",
    "already_rented",
    "other",
  ]),
  details: z.string().max(1000).optional(),
});

export const propertyIdParamSchema = z.object({ id: z.string().uuid() });
export const propertyImageParamSchema = z.object({
  id: z.string().uuid(),
  imageId: z.string().uuid(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Phase 5 Part 7 (Recommendations).
export const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(8),
});
