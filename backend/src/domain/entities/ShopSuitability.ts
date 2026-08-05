// Phase 2 Part 2 (Shop Listing UI): the closed vocabulary for a shop
// listing's "Suitable For" multi-select. Mirrors PROPERTY_FEATURE_KEYS'
// pattern in PropertyFeature.ts (a plain `as const` string array + derived
// union type), but kept as its own file/domain concept rather than folded
// into PROPERTY_FEATURE_KEYS -- amenities (gym, lift, security, ...) and a
// shop's business-suitability tags (retail, clothing, medical, ...) are
// conceptually different vocabularies that happen to both render as
// chip/checkbox multi-selects.
export const SUITABLE_FOR_KEYS = [
  "retail",
  "clothing",
  "mobile",
  "electronics",
  "medical",
  "restaurant",
  "office",
  "salon",
  "coaching",
  "warehouse",
  "other",
] as const;

export type SuitableForKey = (typeof SUITABLE_FOR_KEYS)[number];
