import { IGeocodingService, PostalCodeLookupResult } from "@/domain/services/IGeocodingService";
import { ValidationError } from "@/domain/errors/AppError";

export interface GeocodePostalCodeInput {
  postalCode: string;
  country?: string;
}

/**
 * Backs the PIN-code-first location workflow (Phase 2 Part 1): the user
 * types only a PIN code and the Address step immediately auto-fills
 * country/state/district/city/locality (and drops a map marker) from this
 * result. Returns every distinct locality candidate the geocoding service
 * found for the PIN -- the frontend shows a picker when there's more than
 * one, or auto-fills directly when there's exactly one.
 */
export class GeocodePostalCodeUseCase {
  constructor(private readonly geocodingService: IGeocodingService) {}

  async execute(input: GeocodePostalCodeInput): Promise<PostalCodeLookupResult[]> {
    const postalCode = input.postalCode?.trim();
    if (!postalCode) {
      throw new ValidationError("Enter a PIN code to look up");
    }
    const results = await this.geocodingService.geocodeByPostalCode(postalCode, input.country);
    if (results.length === 0) {
      throw new ValidationError(
        `Could not find a location for PIN code "${postalCode}". Double-check the code, or place the marker manually on the map.`,
      );
    }
    return results;
  }
}
