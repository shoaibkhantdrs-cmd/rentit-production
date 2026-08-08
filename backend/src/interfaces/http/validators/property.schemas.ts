import { z } from "zod";
import { PROPERTY_FEATURE_KEYS } from "@/domain/entities/PropertyFeature";
import { SUITABLE_FOR_KEYS } from "@/domain/entities/ShopSuitability";

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
// Phase 2 Part 2 (Shop Listing UI).
const suitableForEnum = z.enum(SUITABLE_FOR_KEYS);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

// Phase 3 Part 1 (Shop Search & Filters). z.coerce.boolean() treats any
// non-empty string (including "false") as true -- this maps the literal
// query-string values instead. Same helper as admin.schemas.ts's
// booleanQueryParam, kept local here rather than shared/imported since
// each validator file already keeps its own small helpers.
const booleanQueryParam = z.preprocess((val) => {
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}, z.boolean().optional());

// Phase 3 Part 1 (Shop Search & Filters). Query-string arrays arrive as
// either a repeated key (already an array by the time Express/qs parses
// it) or a single comma-joined string, depending on client -- this accepts
// both and normalizes to a string array before the z.enum array check.
const commaSeparatedArray = (schema: z.ZodTypeAny) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return val;
  }, z.array(schema).optional());

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

export const createPropertySchema = z
  .object({
    title: z.string().min(5).max(200),
    description: z.string().min(20).max(5000),
    categoryId: z.string().uuid(),
    propertyType: propertyTypeEnum,
    rentAmount: z.number().min(0),
    securityDeposit: z.number().min(0).default(0),
    // Reused as "Shop Carpet Area" for propertyType "shop" (Phase 2 Part 2)
    // -- already required/positive for every property type, so no extra
    // shop-specific requirement is needed here.
    areaSqft: z.number().positive(),
    bedrooms: z.number().int().min(0).default(0),
    bathrooms: z.number().int().min(0).default(0),
    parkingSpaces: z.number().int().min(0).default(0),
    // Reused as "Floor" for propertyType "shop" -- optional here (matches
    // every other property type), made conditionally required by the
    // superRefine below only when propertyType === "shop".
    floorNumber: z.number().int().optional(),
    totalFloors: z.number().int().optional(),
    facing: facingEnum.optional(),
    furnishedStatus: furnishedStatusEnum.default("unfurnished"),
    availableFrom: dateOnly,
    features: z.array(featureKeyEnum).max(20).optional(),
    location: locationSchema,
    // Phase 2 Part 2 (Shop Listing UI): shop-only fields. Present on the
    // schema for every property type (so a client never gets a "not
    // recognized" 400 for sending them), but only meaningful/validated
    // when propertyType === "shop" -- see CreateProperty.usecase.ts, which
    // simply stores them as null for every other type.
    frontWidthFt: z.number().min(0).optional(),
    shopDepthFt: z.number().min(0).optional(),
    roadWidthFt: z.number().min(0).optional(),
    powerLoad: z.string().max(60).optional(),
    isCornerShop: z.boolean().optional(),
    hasWashroom: z.boolean().optional(),
    readyToMove: z.boolean().optional(),
    suitableFor: z.array(suitableForEnum).max(SUITABLE_FOR_KEYS.length).optional(),
  })
  // Shop listings require only Shop Carpet Area (areaSqft, already
  // required above for every type), Floor (floorNumber), Address
  // (location.addressLine, already required above), and PIN Code
  // (location.postalCode) -- everything else shop-specific stays optional.
  .superRefine((data, ctx) => {
    if (data.propertyType !== "shop") return;
    if (data.floorNumber === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["floorNumber"],
        message: "Floor is required for shop listings",
      });
    }
    if (!data.location.postalCode || !data.location.postalCode.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "postalCode"],
        message: "PIN code is required for shop listings",
      });
    }
  });

export const updatePropertySchema = z
  .object({
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
    // Phase 2 Part 2 (Shop Listing UI). Not conditionally required on update
    // -- a partial edit (e.g. photos-only) shouldn't be blocked by an
    // unrelated shop field being absent from this particular request.
    frontWidthFt: z.number().min(0).nullable().optional(),
    shopDepthFt: z.number().min(0).nullable().optional(),
    roadWidthFt: z.number().min(0).nullable().optional(),
    powerLoad: z.string().max(60).nullable().optional(),
    isCornerShop: z.boolean().nullable().optional(),
    hasWashroom: z.boolean().nullable().optional(),
    readyToMove: z.boolean().nullable().optional(),
    suitableFor: z.array(suitableForEnum).max(SUITABLE_FOR_KEYS.length).nullable().optional(),
  })
  // Phase 3 Part 2: require Floor + PIN when a request converts an
  // existing property to "shop" -- mirrors createPropertySchema's
  // superRefine above, but with an important PATCH-semantics caveat.
  //
  // updatePropertySchema only ever sees this one request body, never the
  // property's existing DB row -- UpdatePropertyUseCase.execute() is what
  // computes `effectivePropertyType = input.propertyType ?? existing.propertyType`
  // (see UpdateProperty.usecase.ts), and that merge happens *after* this
  // schema has already validated the raw payload. A schema-level check
  // therefore cannot know whether an already-shop property (whose
  // propertyType is simply omitted from this particular patch) already
  // has a floor/PIN on file, and must not guess.
  //
  // This check is deliberately scoped to only the request that explicitly
  // sets propertyType: "shop" in its own payload -- i.e. "the request
  // that performs the conversion must supply Floor and PIN in that same
  // request". Concretely:
  //   - An unrelated partial edit to an already-shop listing that doesn't
  //     resend propertyType (data.propertyType is undefined) never
  //     triggers this check, so it can never incorrectly fail -- exactly
  //     the case the previous "not conditionally required on update"
  //     comment above was protecting.
  //   - A request that does set propertyType: "shop" must also carry
  //     floorNumber and location.postalCode in that same request.
  //     PropertyForm.tsx always resubmits its full current form state
  //     (not a sparse patch) on save, so a real conversion performed
  //     through the product UI already includes both fields naturally;
  //     this only blocks a bare/malformed API call that tries to convert
  //     a listing to "shop" without ever supplying Floor/PIN.
  .superRefine((data, ctx) => {
    if (data.propertyType !== "shop") return;
    if (data.floorNumber === undefined || data.floorNumber === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["floorNumber"],
        message: "Floor is required when converting a listing to a shop",
      });
    }
    const postalCode = data.location?.postalCode;
    if (!postalCode || !postalCode.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location", "postalCode"],
        message: "PIN code is required when converting a listing to a shop",
      });
    }
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
  // Phase 3 Part 1 (Shop Search & Filters). All optional and additive --
  // absent for every existing client/bookmarked URL, so residential search
  // behavior is unchanged when these aren't sent. See
  // buildPropertySearchQuery.ts for how each maps to a nullable shop-only
  // column (NULL for every non-shop row).
  frontWidthMin: z.coerce.number().min(0).optional(),
  roadWidthMin: z.coerce.number().min(0).optional(),
  readyToMove: booleanQueryParam,
  isCornerShop: booleanQueryParam,
  hasWashroom: booleanQueryParam,
  suitableFor: commaSeparatedArray(suitableForEnum),
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
