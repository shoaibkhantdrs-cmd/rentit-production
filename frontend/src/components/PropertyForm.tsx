import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { propertiesApi } from "@/api/properties";
import { ApiError } from "@/api/httpClient";
import {
  CreatePropertyPayload,
  Facing,
  FurnishedStatus,
  PROPERTY_FEATURE_KEYS,
  PropertyCategory,
  PropertyDetail,
  PropertyType,
} from "@/api/types";

// See AddPropertyPage.tsx's RequiredMark for the rationale -- kept as an
// inline style rather than a new index.css class so this stays
// self-contained to this file's own diff.
function RequiredMark() {
  return (
    <span aria-hidden="true" style={{ color: "var(--color-danger, #dc2626)" }}>
      *
    </span>
  );
}

const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "villa",
  "studio",
  "pg",
  "room",
  "commercial",
  "other",
];
const FACINGS: Facing[] = [
  "north",
  "south",
  "east",
  "west",
  "north_east",
  "north_west",
  "south_east",
  "south_west",
];
const FURNISHED: FurnishedStatus[] = ["unfurnished", "semi_furnished", "fully_furnished"];

export type PropertyFormValues = CreatePropertyPayload;

function buildInitialValues(initial?: PropertyDetail): PropertyFormValues {
  if (!initial) {
    return {
      title: "",
      description: "",
      categoryId: "",
      propertyType: "apartment",
      rentAmount: 0,
      securityDeposit: 0,
      areaSqft: 0,
      bedrooms: 1,
      bathrooms: 1,
      parkingSpaces: 0,
      furnishedStatus: "unfurnished",
      availableFrom: new Date().toISOString().slice(0, 10),
      features: [],
      location: { addressLine: "", city: "", state: "", country: "India", postalCode: "" },
    };
  }
  return {
    title: initial.title,
    description: initial.description,
    categoryId: initial.category?.id ?? "",
    propertyType: initial.propertyType,
    rentAmount: initial.rentAmount,
    securityDeposit: initial.securityDeposit,
    areaSqft: initial.areaSqft,
    bedrooms: initial.bedrooms,
    bathrooms: initial.bathrooms,
    parkingSpaces: initial.parkingSpaces,
    floorNumber: initial.floorNumber ?? undefined,
    totalFloors: initial.totalFloors ?? undefined,
    facing: initial.facing ?? undefined,
    furnishedStatus: initial.furnishedStatus,
    availableFrom: initial.availableFrom,
    features: initial.features,
    location: {
      addressLine: initial.location?.addressLine ?? "",
      city: initial.location?.city ?? "",
      locality: initial.location?.locality ?? undefined,
      state: initial.location?.state ?? undefined,
      country: initial.location?.country ?? undefined,
      postalCode: initial.location?.postalCode ?? undefined,
      latitude: initial.location?.latitude,
      longitude: initial.location?.longitude,
    },
  };
}

interface PropertyFormProps {
  initial?: PropertyDetail;
  submitLabel: string;
  onSubmit: (values: PropertyFormValues) => Promise<void>;
}

export function PropertyForm({ initial, submitLabel, onSubmit }: PropertyFormProps) {
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [values, setValues] = useState<PropertyFormValues>(() => buildInitialValues(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  // Geocoding failures, same as AddPropertyPage.tsx's wizard: shown next to
  // the Location section instead of the generic top-of-form `error`
  // banner, and cleared automatically the instant any address field
  // changes (updateAddressField).
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    propertiesApi
      .categories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategoriesError("Could not load categories. Refresh the page to try again."));
  }, []);

  const update = <K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateLocation = <K extends keyof PropertyFormValues["location"]>(
    key: K,
    value: PropertyFormValues["location"][K],
  ) => {
    setValues((prev) => ({ ...prev, location: { ...prev.location, [key]: value } }));
  };

  // Address text fields go through this instead of updateLocation directly
  // -- editing the address after latitude/longitude were already set (via
  // "Use current location", or already resolved on the existing property
  // being edited) must invalidate those now-stale coordinates so the
  // backend re-geocodes from exactly what's currently in the form, instead
  // of silently keeping a location that no longer matches the text.
  const updateAddressField = <K extends keyof PropertyFormValues["location"]>(
    key: K,
    value: PropertyFormValues["location"][K],
  ) => {
    setValues((prev) => ({
      ...prev,
      location: { ...prev.location, [key]: value, latitude: undefined, longitude: undefined },
    }));
    setGeoStatus(null);
    setGeoError(null);
  };

  const toggleFeature = (feature: string) => {
    setValues((prev) => {
      const current = prev.features ?? [];
      const next = current.includes(feature)
        ? current.filter((f) => f !== feature)
        : [...current, feature];
      return { ...prev, features: next };
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Your browser doesn't support geolocation.");
      return;
    }
    setGeoStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation("latitude", position.coords.latitude);
        updateLocation("longitude", position.coords.longitude);
        setGeoStatus("Current location captured.");
      },
      () => setGeoStatus("Could not get your location. You can still enter the address manually."),
    );
  };

  // Mirrors NominatimGeocodingService's own India-detection heuristic --
  // see AddPropertyPage.tsx's identical helper for the full rationale.
  const isIndianAddress = (() => {
    const normalized = (values.location.country ?? "").trim().toLowerCase();
    return !normalized || normalized === "india" || normalized === "in";
  })();

  const handlePostalCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = isIndianAddress ? raw.replace(/[^0-9]/g, "").slice(0, 6) : raw.slice(0, 20);
    updateAddressField("postalCode", next || undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setGeoError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      // Same detection as AddPropertyPage.tsx's wizard: a VALIDATION_ERROR
      // reaching this catch block (i.e. after the request body already
      // passed schema validation) with a geocoding-shaped message can only
      // be NominatimGeocodingService failing to resolve the address.
      const isGeocodingFailure =
        err instanceof ApiError && err.code === "VALIDATION_ERROR" && /geocod|resolve a location/i.test(err.message);
      if (isGeocodingFailure) {
        setGeoError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not save this listing. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="form-section">
        <h2>Basics</h2>
        <div className="field">
          <label htmlFor="pf-title">Title</label>
          <input
            id="pf-title"
            required
            minLength={5}
            maxLength={200}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-description">Description</label>
          <textarea
            id="pf-description"
            required
            minLength={20}
            maxLength={5000}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-category">Category</label>
            <select
              id="pf-category"
              required
              value={values.categoryId}
              onChange={(e) => update("categoryId", e.target.value)}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {categoriesError ? <span className="field-error">{categoriesError}</span> : null}
          </div>
          <div className="field">
            <label htmlFor="pf-type">Property type</label>
            <select
              id="pf-type"
              value={values.propertyType}
              onChange={(e) => update("propertyType", e.target.value as PropertyType)}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Pricing &amp; size</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-rent">Monthly rent (₹)</label>
            <input
              id="pf-rent"
              type="number"
              min={0}
              required
              value={values.rentAmount}
              onChange={(e) => update("rentAmount", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-deposit">Security deposit (₹)</label>
            <input
              id="pf-deposit"
              type="number"
              min={0}
              value={values.securityDeposit}
              onChange={(e) => update("securityDeposit", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-area">Area (sqft)</label>
            <input
              id="pf-area"
              type="number"
              min={1}
              required
              value={values.areaSqft}
              onChange={(e) => update("areaSqft", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-available">Available from</label>
            <input
              id="pf-available"
              type="date"
              required
              value={values.availableFrom}
              onChange={(e) => update("availableFrom", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-bedrooms">Bedrooms</label>
            <input
              id="pf-bedrooms"
              type="number"
              min={0}
              value={values.bedrooms}
              onChange={(e) => update("bedrooms", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-bathrooms">Bathrooms</label>
            <input
              id="pf-bathrooms"
              type="number"
              min={0}
              value={values.bathrooms}
              onChange={(e) => update("bathrooms", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-parking">Parking spaces</label>
            <input
              id="pf-parking"
              type="number"
              min={0}
              value={values.parkingSpaces}
              onChange={(e) => update("parkingSpaces", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-furnished">Furnished status</label>
            <select
              id="pf-furnished"
              value={values.furnishedStatus}
              onChange={(e) => update("furnishedStatus", e.target.value as FurnishedStatus)}
            >
              {FURNISHED.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-floor">Floor number</label>
            <input
              id="pf-floor"
              type="number"
              value={values.floorNumber ?? ""}
              onChange={(e) => update("floorNumber", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-total-floors">Total floors</label>
            <input
              id="pf-total-floors"
              type="number"
              value={values.totalFloors ?? ""}
              onChange={(e) => update("totalFloors", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-facing">Facing</label>
            <select
              id="pf-facing"
              value={values.facing ?? ""}
              onChange={(e) => update("facing", (e.target.value || undefined) as Facing | undefined)}
            >
              <option value="">Not specified</option>
              {FACINGS.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Location</h2>
        {geoError ? <div className="alert alert--error">{geoError}</div> : null}
        <div className="field">
          <label htmlFor="pf-address">
            Address Line <RequiredMark />
          </label>
          <input
            id="pf-address"
            required
            minLength={5}
            value={values.location.addressLine}
            onChange={(e) => updateAddressField("addressLine", e.target.value)}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-locality">Locality</label>
            <input
              id="pf-locality"
              value={values.location.locality ?? ""}
              onChange={(e) => updateAddressField("locality", e.target.value || undefined)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-city">
              City <RequiredMark />
            </label>
            <input
              id="pf-city"
              required
              minLength={2}
              value={values.location.city}
              onChange={(e) => updateAddressField("city", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-state">State</label>
            <input
              id="pf-state"
              value={values.location.state ?? ""}
              onChange={(e) => updateAddressField("state", e.target.value || undefined)}
            />
          </div>
          <div className="field">
            <label htmlFor="pf-postal-code">PIN code</label>
            <input
              id="pf-postal-code"
              inputMode="numeric"
              maxLength={isIndianAddress ? 6 : 20}
              value={values.location.postalCode ?? ""}
              onChange={handlePostalCodeChange}
            />
            <span className="field-hint">{isIndianAddress ? "6-digit Indian PIN code" : "Postal / ZIP code"}</span>
          </div>
          <div className="field">
            <label htmlFor="pf-country">Country</label>
            <input
              id="pf-country"
              value={values.location.country ?? ""}
              onChange={(e) => updateAddressField("country", e.target.value || undefined)}
            />
          </div>
        </div>
        <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={useCurrentLocation}>
          Use current location
        </button>
        {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}
        <p className="field-hint">
          Leave latitude/longitude blank to have the address geocoded automatically from Address Line, Locality,
          City, State, PIN code and Country.
        </p>
      </div>

      <div className="form-section">
        <h2>Features</h2>
        <div className="checkbox-grid">
          {PROPERTY_FEATURE_KEYS.map((feature) => (
            <label key={feature} className="checkbox-tile">
              <input
                type="checkbox"
                checked={(values.features ?? []).includes(feature)}
                onChange={() => toggleFeature(feature)}
              />
              {feature.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn-v2 btn-v2--primary" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
