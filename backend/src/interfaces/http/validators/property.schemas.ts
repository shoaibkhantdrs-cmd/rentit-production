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
  "shop",
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
  // Phase 2 Part 1 (PIN-first Address step): auto-filled from the postal
  // code / reverse-geocode lookup alongside state/city/country -- never
  // typed by the user directly, but still a plain optional string here so
  // older clients that never send it keep working unchanged.
  district: z.string().max(120).optional(),
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

// Phase 2 Part 1 (PIN-first Address step): postal-code-to-locality lookup
// and marker-drag/current-location reverse geocoding. postalCode is kept as
// a loose 3-10 char string (not hard-coded to 6 digits) so a non-Indian
// postal code doesn't get rejected before it even reaches the geocoding
// service, which already has its own India-detection heuristic.
export const postalCodeLookupQuerySchema = z.object({
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().max(120).optional(),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
