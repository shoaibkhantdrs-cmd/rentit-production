export const PROPERTY_FEATURE_KEYS = [
  "gym",
  "swimming_pool",
  "power_backup",
  "lift",
  "security",
  "park",
  "club_house",
  "wifi",
  "pet_friendly",
  "water_supply",
  "cctv",
  "fire_safety",
  "intercom",
  "rain_water_harvesting",
  "gas_pipeline",
  "servant_room",
] as const;

export type PropertyFeatureKey = (typeof PROPERTY_FEATURE_KEYS)[number];

export interface PropertyFeature {
  id: string;
  propertyId: string;
  featureKey: PropertyFeatureKey | string;
  createdAt: Date;
}
