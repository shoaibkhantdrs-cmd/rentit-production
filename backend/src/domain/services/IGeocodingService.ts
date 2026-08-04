export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
}

/**
 * Every field the caller currently has for the address being geocoded.
 * Bug fix: this used to be three positional arguments
 * (addressLine, city, locality) -- state/postalCode/country were collected
 * by the backend's own validation schema and DB columns but structurally
 * could never reach the geocoding provider, because the function signature
 * itself had no parameters for them. A single named-field object (instead
 * of more positional args) also makes call sites self-documenting and
 * immune to accidental argument-order bugs.
 */
export interface GeocodeAddressInput {
  addressLine: string;
  city: string;
  locality?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/** Port over Nominatim (OpenStreetMap) -- see infrastructure/maps/NominatimGeocodingService.ts. */
export interface IGeocodingService {
  geocode(input: GeocodeAddressInput): Promise<GeocodeResult>;
}
