import { IGeocodingService, ReverseGeocodeResult } from "@/domain/services/IGeocodingService";
import { ValidationError } from "@/domain/errors/AppError";

export interface ReverseGeocodeLocationInput {
  latitude: number;
  longitude: number;
}

/**
 * Backs the "drag the marker to correct your pin" and "Use current
 * location" flows (Phase 2 Part 1): resolves a lat/lng pair back to address
 * components so the Address step's country/state/district/city/locality
 * fields can be kept in sync with wherever the user actually dropped it.
 */
export class ReverseGeocodeLocationUseCase {
  constructor(private readonly geocodingService: IGeocodingService) {}

  async execute(input: ReverseGeocodeLocationInput): Promise<ReverseGeocodeResult> {
    if (
      typeof input.latitude !== "number" ||
      typeof input.longitude !== "number" ||
      Number.isNaN(input.latitude) ||
      Number.isNaN(input.longitude)
    ) {
      throw new ValidationError("A valid latitude and longitude are required");
    }
    return this.geocodingService.reverseGeocode(input.latitude, input.longitude);
  }
}
