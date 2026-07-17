/** Shared formatting helpers for the premium redesign -- previously each
 * component (PropertyCard, PropertyDetailsPage, ...) defined its own
 * `formatRent`, which drifted in subtle ways (maximumFractionDigits vs not).
 * One source of truth now. */

const rupeeFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatCurrency(amount: number): string {
  return `₹${rupeeFormatter.format(amount)}`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
