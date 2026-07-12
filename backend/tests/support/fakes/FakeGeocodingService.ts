import { GeocodeResult, IGeocodingService } from "@/domain/services/IGeocodingService";

/** Stands in for Google's Geocoding API with deterministic, offline coordinates. */
export class FakeGeocodingService implements IGeocodingService {
  public readonly calls: Array<{ addressLine: string; city: string; locality?: string | null }> = [];

  /** Override per-test to simulate a specific city's coordinates. */
  public nextResult: GeocodeResult = {
    latitude: 19.076,
    longitude: 72.8777,
    formattedAddress: "Fake Formatted Address, Mumbai, India",
    placeId: "fake-place-id",
  };

  async geocode(addressLine: string, city: string, locality?: string | null): Promise<GeocodeResult> {
    this.calls.push({ addressLine, city, locality });
    return this.nextResult;
  }
}
