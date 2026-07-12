export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
}

/** Port over Google's Geocoding API -- see infrastructure/maps/GoogleGeocodingService.ts. */
export interface IGeocodingService {
  geocode(addressLine: string, city: string, locality?: string | null): Promise<GeocodeResult>;
}
