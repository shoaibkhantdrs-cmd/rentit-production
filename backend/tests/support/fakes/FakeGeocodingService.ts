import { GeocodeAddressInput, GeocodeResult, IGeocodingService } from "@/domain/services/IGeocodingService";

/** Stands in for the real Nominatim integration with deterministic, offline coordinates. */
export class FakeGeocodingService implements IGeocodingService {
  // Records the exact input object each call received (addressLine, city,
  // locality, state, postalCode, country) -- tests can still read
  // `calls[0].city` etc. directly since this pushes the full input
  // unchanged, just like the old positional-args version did.
  public readonly calls: GeocodeAddressInput[] = [];

  /** Override per-test to simulate a specific city's coordinates. */
  public nextResult: GeocodeResult = {
    latitude: 19.076,
    longitude: 72.8777,
    formattedAddress: "Fake Formatted Address, Mumbai, India",
    placeId: "fake-place-id",
  };

  async geocode(input: GeocodeAddressInput): Promise<GeocodeResult> {
    this.calls.push({ ...input });
    return this.nextResult;
  }
}
