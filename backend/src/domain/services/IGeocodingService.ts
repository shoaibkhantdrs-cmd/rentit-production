export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
}

/** Port over Nominatim (OpenStreetMap) -- see infrastructure/maps/NominatimGeocodingService.ts. */
export interface IGeocodingService {
  geocode(addressLine: string, city: string, locality?: string | null): Promise<GeocodeResult>;
}
