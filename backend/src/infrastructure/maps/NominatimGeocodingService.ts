import { GeocodeResult, IGeocodingService } from "@/domain/services/IGeocodingService";
import { ValidationError } from "@/domain/errors/AppError";

interface NominatimSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Real integration with OpenStreetMap's Nominatim search API
 * (https://nominatim.openstreetmap.org/search) via the platform's built-in
 * `fetch` -- no extra SDK dependency, same "no SDK, just fetch" approach
 * already used for TwilioSmsService/BrevoEmailService.
 *
 * Replaces GoogleGeocodingService (removed 2026-07-29): every property
 * listing was hard-blocked in production because GOOGLE_MAPS_API_KEY was
 * never configured on Render, and Google's Geocoding API requires a billed,
 * key-gated project. Nominatim's public instance requires no API key or
 * account at all -- it's free, keyless, and license-compatible (ODbL) for
 * an app at this scale.
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * requires a descriptive User-Agent identifying the application and caps
 * the public instance at ~1 request/second. This service sends a real
 * User-Agent for that reason; it does not implement client-side rate
 * limiting, since property creation/update is a low-frequency, human-driven
 * action (not a bulk/batch geocoding workload) -- if that ever changes,
 * either add a request queue here or move to a self-hosted/paid Nominatim
 * instance.
 */
export class NominatimGeocodingService implements IGeocodingService {
  private static readonly BASE_URL = "https://nominatim.openstreetmap.org/search";

  async geocode(addressLine: string, city: string, locality?: string | null): Promise<GeocodeResult> {
    const fullAddress = [addressLine, locality, city].filter(Boolean).join(", ");
    const url = new URL(NominatimGeocodingService.BASE_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", fullAddress);
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        // Required by Nominatim's usage policy -- requests without a
        // descriptive User-Agent are liable to be blocked outright.
        "User-Agent": "RentIt/1.0 (property listing geocoding; contact: support@rentit.example)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ValidationError(`Geocoding request failed with HTTP ${response.status}`);
    }

    const results = (await response.json()) as NominatimSearchResult[];

    if (!Array.isArray(results) || results.length === 0) {
      throw new ValidationError(
        `Could not resolve a location for "${fullAddress}" (Nominatim returned no results). ` +
          "Provide latitude/longitude directly instead.",
      );
    }

    const best = results[0];
    return {
      latitude: parseFloat(best.lat),
      longitude: parseFloat(best.lon),
      formattedAddress: best.display_name,
      placeId: best.place_id != null ? String(best.place_id) : null,
    };
  }
}
