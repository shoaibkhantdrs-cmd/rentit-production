import {
  GeocodeAddressInput,
  GeocodeResult,
  IGeocodingService,
  PostalCodeLookupResult,
  ReverseGeocodeResult,
} from "@/domain/services/IGeocodingService";

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

  public postalCodeCalls: Array<{ postalCode: string; country?: string }> = [];

  /** Override per-test to simulate one or more locality candidates for a PIN code. */
  public nextPostalCodeResults: PostalCodeLookupResult[] = [
    {
      country: "India",
      state: "Maharashtra",
      district: "Mumbai",
      city: "Mumbai",
      locality: "Fake Locality",
      postalCode: "400001",
      latitude: 19.076,
      longitude: 72.8777,
      formattedAddress: "Fake Locality, Mumbai, Maharashtra, India",
    },
  ];

  async geocodeByPostalCode(postalCode: string, country?: string): Promise<PostalCodeLookupResult[]> {
    this.postalCodeCalls.push({ postalCode, country });
    return this.nextPostalCodeResults;
  }

  public reverseGeocodeCalls: Array<{ latitude: number; longitude: number }> = [];

  /** Override per-test to simulate a specific reverse-geocode result. */
  public nextReverseGeocodeResult: ReverseGeocodeResult = {
    country: "India",
    state: "Maharashtra",
    district: "Mumbai",
    city: "Mumbai",
    locality: "Fake Locality",
    formattedAddress: "Fake Locality, Mumbai, Maharashtra, India",
    latitude: 19.076,
    longitude: 72.8777,
  };

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    this.reverseGeocodeCalls.push({ latitude, longitude });
    return this.nextReverseGeocodeResult;
  }
}
