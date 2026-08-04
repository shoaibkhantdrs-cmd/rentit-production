import { GeocodeAddressInput, GeocodeResult, IGeocodingService } from "@/domain/services/IGeocodingService";
import { ValidationError } from "@/domain/errors/AppError";
import { logger } from "@/infrastructure/logging/logger";

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

  async geocode(input: GeocodeAddressInput): Promise<GeocodeResult> {
    const { addressLine, city, locality, state, postalCode, country } = input;

    // Bug fix: this used to only ever receive/use addressLine+locality+city
    // -- state/postalCode/country were collected by the backend's own
    // validation schema and DB columns but structurally could never reach
    // Nominatim, because the old signature had no parameters for them (see
    // IGeocodingService.ts). This now geocodes exactly (and only) the
    // fields the caller actually passed in -- nothing here reads from any
    // cache, previous request, or stale draft; every call is a fresh
    // request built solely from `input`.
    //
    // This platform is India-only in practice (₹ currency throughout, no
    // other-country listings exist) -- restricting Nominatim's search to
    // India when the country is unset or explicitly "India"/"IN" measurably
    // improves match accuracy for exactly the kind of address in the bug
    // report: an unindexed building name ("Rolex Estate") or a small
    // locality ("Kamta") is ambiguous worldwide, but resolves cleanly once
    // the search is scoped to one country.
    const normalizedCountry = country?.trim().toLowerCase();
    const isIndia = !normalizedCountry || normalizedCountry === "india" || normalizedCountry === "in";

    // Nominatim's *structured* query (individual street/city/state/country/
    // postalcode params, as opposed to one freeform "q" string) generally
    // resolves real postal addresses more reliably, because it lets
    // Nominatim's own parser assign each fragment to the right
    // administrative level instead of guessing from an ambiguous
    // comma-separated blob. "street" carries the building/estate name plus
    // locality, since Nominatim has no dedicated field for an Indian-style
    // sub-locality.
    const street = [addressLine, locality].filter(Boolean).join(", ");
    const structuredParams = new URLSearchParams({ format: "jsonv2", limit: "1", addressdetails: "1" });
    if (street) structuredParams.set("street", street);
    structuredParams.set("city", city);
    if (state) structuredParams.set("state", state);
    if (postalCode) structuredParams.set("postalcode", postalCode);
    if (country) structuredParams.set("country", country);
    else if (isIndia) structuredParams.set("country", "India");
    if (isIndia) structuredParams.set("countrycodes", "in");

    // Full comma-separated string -- used both as the freeform fallback
    // query (if the structured lookup finds nothing, e.g. because a
    // building/estate name isn't independently indexed) and as the
    // human-readable value in the log line below, so the exact request can
    // be compared directly against what the user typed into the form.
    const fullAddress = [addressLine, locality, city, state, postalCode, country]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(", ");

    logger.info(
      {
        requestedFields: { addressLine, city, locality, state, postalCode, country },
        structuredQuery: Object.fromEntries(structuredParams),
        freeformFallbackQuery: fullAddress,
      },
      "Geocoding request: exact fields and query being sent to Nominatim",
    );

    let best = await this.searchOnce(structuredParams);

    if (!best) {
      const freeformParams = new URLSearchParams({ format: "jsonv2", limit: "1", q: fullAddress });
      if (isIndia) freeformParams.set("countrycodes", "in");
      logger.info(
        { freeformFallbackQuery: fullAddress },
        "Structured geocoding query returned no results -- retrying with a freeform query",
      );
      best = await this.searchOnce(freeformParams);
    }

    if (!best) {
      throw new ValidationError(
        `Could not resolve a location for "${fullAddress}" (Nominatim returned no results). ` +
          "Provide latitude/longitude directly instead.",
      );
    }

    logger.info(
      { requested: fullAddress, resolvedDisplayName: best.display_name, lat: best.lat, lon: best.lon },
      "Geocoding resolved successfully",
    );

    return {
      latitude: parseFloat(best.lat),
      longitude: parseFloat(best.lon),
      formattedAddress: best.display_name,
      placeId: best.place_id != null ? String(best.place_id) : null,
    };
  }

  private async searchOnce(params: URLSearchParams): Promise<NominatimSearchResult | null> {
    const url = new URL(NominatimGeocodingService.BASE_URL);
    url.search = params.toString();

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
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  }
}
