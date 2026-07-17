/**
 * Fixed pricing for the two boost products. Kept in env/config rather
 * than a database table (unlike premium_plans, which genuinely has
 * multiple tiers worth managing as data) -- these are two numbers an
 * operator tunes occasionally, not a catalog.
 */
export interface PaymentPricingConfig {
  featuredListingPriceAmount: number; // smallest currency unit
  featuredListingDurationDays: number;
  boostListingPriceAmount: number;
  boostListingDurationDays: number;
  currency: string;
}
