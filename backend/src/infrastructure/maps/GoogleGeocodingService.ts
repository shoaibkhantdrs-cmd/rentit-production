import { GeocodeResult, IGeocodingService } from "@/domain/services/IGeocodingService";
import { ValidationError } from "@/domain/errors/AppError";

interface GoogleGeocodeApiResult {
  status: string;
  results: Array<{
    formatted_address: string;
    place_id: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
}

/**
 * Real integration with the Google Maps Geocoding REST API via the
 * platform's built-in `fetch` -- no extra SDK dependency needed for a
 * single GET endpoint.
 */
export class GoogleGeocodingService implements IGeocodingService {
  constructor(private readonly apiKey: string) {}

  async geocode(addressLine: string, city: string, locality?: string | null): Promise<GeocodeResult> {
    const fullAddress = [addressLine, locality, city].filter(Boolean).join(", ");
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", fullAddress);
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ValidationError(`Geocoding request failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as GoogleGeocodeApiResult;

    if (data.status !== "OK" || data.results.length === 0) {
      throw new ValidationError(
        `Could not resolve a location for "${fullAddress}" (Google status: ${data.status}). ` +
          "Provide latitude/longitude directly instead.",
      );
    }

    const best = data.results[0];
    return {
      latitude: best.geometry.location.lat,
      longitude: best.geometry.location.lng,
      formattedAddress: best.formatted_address,
      placeId: best.place_id,
    };
  }
}
