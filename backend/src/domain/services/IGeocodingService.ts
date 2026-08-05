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

/**
 * One resolved locality candidate for a postal/PIN code. A single Indian PIN
 * code can legitimately cover more than one locality (e.g. several
 * neighbourhoods sharing one PIN) -- geocodeByPostalCode returns every
 * distinct locality it found so the caller can ask the user to pick one when
 * there's more than one, instead of silently guessing.
 */
export interface PostalCodeLookupResult {
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  locality: string | null;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/** Result of resolving a single lat/lng pair back to address components (e.g. after a marker is dragged). */
export interface ReverseGeocodeResult {
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  locality: string | null;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

/** Port over Nominatim (OpenStreetMap) -- see infrastructure/maps/NominatimGeocodingService.ts. */
export interface IGeocodingService {
  geocode(input: GeocodeAddressInput): Promise<GeocodeResult>;

  /**
   * Backs the PIN-code-first Address step (Phase 2 Part 1): the user types
   * only a postal code and this resolves it to every distinct locality
   * Nominatim knows about for that code, each with its own
   * country/state/district/city/locality and coordinates already filled in.
   */
  geocodeByPostalCode(postalCode: string, country?: string): Promise<PostalCodeLookupResult[]>;

  /**
   * Backs "drag the marker to correct your pin" and "Use current location":
   * resolves a lat/lng pair back to address components so the Address
   * step's fields can be kept in sync with wherever the map marker actually
   * ends up.
   */
  reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult>;
}
