import { z } from "zod";

// Small, deliberately duplicated subset of property.schemas.ts's enums
// rather than a new shared import -- keeps this file independent of
// property.schemas.ts's internals (which aren't exported) and avoids
// touching a file that's been stable since Phase 3.
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
const furnishedStatusEnum = z.enum(["unfurnished", "semi_furnished", "fully_furnished"]);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

const savedSearchFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  propertyType: propertyTypeEnum.optional(),
  rentMin: z.number().min(0).optional(),
  rentMax: z.number().min(0).optional(),
  bedroomsMin: z.number().int().min(0).optional(),
  bathroomsMin: z.number().int().min(0).optional(),
  parkingMin: z.number().int().min(0).optional(),
  areaMin: z.number().min(0).optional(),
  areaMax: z.number().min(0).optional(),
  city: z.string().max(120).optional(),
  locality: z.string().max(120).optional(),
  furnished: furnishedStatusEnum.optional(),
  availableFrom: dateOnlySchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(500).optional(),
});

export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(120),
  filters: savedSearchFiltersSchema,
  notifyOnMatch: z.boolean().default(true),
});

export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  filters: savedSearchFiltersSchema.optional(),
  notifyOnMatch: z.boolean().optional(),
});

export const savedSearchIdParamSchema = z.object({ id: z.string().uuid() });
