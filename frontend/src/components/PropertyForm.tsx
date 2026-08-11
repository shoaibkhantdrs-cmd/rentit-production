import { ChangeEvent, FormEvent, Suspense, useEffect, useState } from "react";
import { propertiesApi } from "@/api/properties";
import { ApiError } from "@/api/httpClient";
import {
  CreatePropertyPayload,
  Facing,
  FurnishedStatus,
  PostalCodeLookupResult,
  PROPERTY_FEATURE_KEYS,
  PropertyCategory,
  PropertyDetail,
  PropertyType,
  ReverseGeocodeResult,
  SUITABLE_FOR_KEYS,
} from "@/api/types";
import { lazyNamed } from "@/utils/lazyNamed";

// Same lazy-loaded map as AddPropertyPage.tsx's wizard -- see that file for
// the full rationale.
const AddressMap = lazyNamed<typeof import("@/components/AddressMap").AddressMap>(
  () => import("@/components/AddressMap"),
  "AddressMap",
);

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

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
  "shop",
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
    // Phase 2 Part 2 (Shop Listing UI).
    frontWidthFt: initial.frontWidthFt ?? undefined,
    shopDepthFt: initial.shopDepthFt ?? undefined,
    roadWidthFt: initial.roadWidthFt ?? undefined,
    powerLoad: initial.powerLoad ?? undefined,
    isCornerShop: initial.isCornerShop ?? undefined,
    hasWashroom: initial.hasWashroom ?? undefined,
    readyToMove: initial.readyToMove ?? undefined,
    suitableFor: initial.suitableFor,
    location: {
      addressLine: initial.location?.addressLine ?? "",
      city: initial.location?.city ?? "",
      locality: initial.location?.locality ?? undefined,
      district: initial.location?.district ?? undefined,
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
  // Phase 2 Part 1 (PIN-first Address step) state -- mirrors
  // AddPropertyPage.tsx's wizard.
  const [pinLookupStatus, setPinLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pinLookupError, setPinLookupError] = useState<string | null>(null);
  const [localityOptions, setLocalityOptions] = useState<PostalCodeLookupResult[]>([]);
  const [selectedLocalityIndex, setSelectedLocalityIndex] = useState<number | null>(null);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [postalCodeTouched, setPostalCodeTouched] = useState(false);

  // Phase 2 Part 2 (Shop Listing UI): drives the Pricing & size section's
  // conditional field show/hide + relabeling, mirroring
  // AddPropertyPage.tsx's wizard. Every other property type renders this
  // section exactly as before -- untouched.
  const isShop = values.propertyType === "shop";

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

  // Phase 2 Part 1: under the PIN-first flow only the PIN code field should
  // invalidate the marker on edit -- Country/State/District/City/Locality
  // are auto-filled (never manually typed) and Address Line is just
  // descriptive text, not something geocoding depends on. See
  // AddPropertyPage.tsx's identical helper for the full rationale.
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

  // Phase 2 Part 2 (Shop Listing UI): same toggle pattern as toggleFeature
  // above, for the "Suitable For" multi-select.
  const toggleSuitableFor = (tag: string) => {
    setValues((prev) => {
      const current = prev.suitableFor ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, suitableFor: next };
    });
  };

  const digitsOnly = (raw: string) => raw.replace(/[^0-9]/g, "");

  // Applies a resolved result's address fields only, leaving
  // latitude/longitude and addressLine untouched -- used by the
  // marker-drag path, which already owns the new coordinates directly.
  const applyAddressFields = (resolved: PostalCodeLookupResult | ReverseGeocodeResult) => {
    setValues((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        country: resolved.country ?? prev.location.country,
        state: resolved.state ?? undefined,
        district: resolved.district ?? undefined,
        city: resolved.city ?? prev.location.city,
        locality: resolved.locality ?? undefined,
      },
    }));
  };

  // Applies a resolved result's address fields AND places the marker at
  // its coordinates -- used by the PIN-lookup and "Use current location"
  // paths.
  const applyResolvedLocation = (resolved: PostalCodeLookupResult | ReverseGeocodeResult) => {
    setValues((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        country: resolved.country ?? prev.location.country,
        state: resolved.state ?? undefined,
        district: resolved.district ?? undefined,
        city: resolved.city ?? prev.location.city,
        locality: resolved.locality ?? undefined,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      },
    }));
  };

  const lookupPostalCode = async (pin: string) => {
    setPinLookupStatus("loading");
    setPinLookupError(null);
    setLocalityOptions([]);
    setSelectedLocalityIndex(null);
    setGeoError(null);
    try {
      const res = await propertiesApi.geocodePostalCode(pin, values.location.country);
      if (res.items.length === 0) {
        setPinLookupStatus("error");
        setPinLookupError(`Could not find a location for PIN code "${pin}". You can still place the marker manually on the map.`);
        return;
      }
      if (res.items.length === 1) {
        applyResolvedLocation(res.items[0]);
        setPinLookupStatus("success");
        return;
      }
      setLocalityOptions(res.items);
      applyAddressFields(res.items[0]);
      setPinLookupStatus("success");
    } catch (err) {
      setPinLookupStatus("error");
      setPinLookupError(err instanceof ApiError ? err.message : "Could not look up this PIN code. Please try again.");
    }
  };

  const selectLocalityOption = (index: number) => {
    const resolved = localityOptions[index];
    if (!resolved) return;
    setSelectedLocalityIndex(index);
    applyResolvedLocation(resolved);
  };

  // Marker-drag handler -- see AddPropertyPage.tsx's identical helper for
  // the full rationale.
  const handleMarkerMove = async (latitude: number, longitude: number) => {
    updateLocation("latitude", latitude);
    updateLocation("longitude", longitude);
    setReverseGeocoding(true);
    setGeoError(null);
    try {
      const resolved = await propertiesApi.reverseGeocode(latitude, longitude);
      applyAddressFields(resolved);
      setPinLookupStatus("success");
      setPinLookupError(null);
    } catch {
      // Non-fatal -- the marker position already applied above stays put.
    } finally {
      setReverseGeocoding(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Your browser doesn't support geolocation.");
      return;
    }
    setGeoStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocation("latitude", latitude);
        updateLocation("longitude", longitude);
        setGeoStatus("Current location captured -- looking up address...");
        setReverseGeocoding(true);
        setGeoError(null);
        propertiesApi
          .reverseGeocode(latitude, longitude)
          .then((resolved) => {
            applyAddressFields(resolved);
            setPinLookupStatus("success");
            setGeoStatus("Current location captured and address filled in.");
          })
          .catch(() => {
            setGeoStatus("Current location captured. Could not auto-fill the address -- please fill it in manually.");
          })
          .finally(() => setReverseGeocoding(false));
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

  const postalCodeInvalid = Boolean(values.location.postalCode) && values.location.postalCode!.length !== 6;

  const handlePostalCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = isIndianAddress ? digitsOnly(raw).slice(0, 6) : raw.slice(0, 20);
    updateAddressField("postalCode", next || undefined);
    setPinLookupStatus("idle");
    setPinLookupError(null);
    setLocalityOptions([]);
    setSelectedLocalityIndex(null);
    if (isIndianAddress && next.length === 6) {
      void lookupPostalCode(next);
    }
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
              // Phase 2 Part 2 (Shop Listing UI): rentAmount is not one of
              // the shop's four required fields ("Shop Carpet Area, Floor,
              // Address, PIN Code -- everything else optional"), so
              // `required` is dropped for shop. A blank field still
              // submits 0, which the backend's `rentAmount: z.number()
              // .min(0)` accepts.
              required={!isShop}
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
            {/* "Shop Carpet Area" for shop listings reuses this same
                areaSqft field/input -- only the label changes. Already
                required for every property type. */}
            <label htmlFor="pf-area">{isShop ? "Shop Carpet Area (sqft)" : "Area (sqft)"} <RequiredMark /></label>
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
          {/* Phase 2 Part 2 (Shop Listing UI): Bedrooms/Bathrooms/Furnished
              status/Total floors hidden entirely for shop listings, per
              spec. Parking spaces and Facing stay visible for every
              property type. */}
          {!isShop && (
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
          )}
          {!isShop && (
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
          )}
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
          {!isShop && (
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
          )}
          <div className="field">
            {/* "Floor" for shop listings reuses this same floorNumber
                field/input, and becomes required (spec: Shop requires
                Shop Carpet Area, Floor, Address, PIN Code). */}
            <label htmlFor="pf-floor">
              {isShop ? <>Floor <RequiredMark /></> : "Floor number"}
            </label>
            <input
              id="pf-floor"
              type="number"
              required={isShop}
              value={values.floorNumber ?? ""}
              onChange={(e) => update("floorNumber", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </div>
          {!isShop && (
            <div className="field">
              <label htmlFor="pf-total-floors">Total floors</label>
              <input
                id="pf-total-floors"
                type="number"
                value={values.totalFloors ?? ""}
                onChange={(e) => update("totalFloors", e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </div>
          )}
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

          {/* Phase 2 Part 2 (Shop Listing UI): shop-only fields, shown only
              when propertyType === "shop". All optional. */}
          {isShop && (
            <>
              <div className="field">
                <label htmlFor="pf-front-width">Front width (ft)</label>
                <input
                  id="pf-front-width"
                  type="number"
                  min={0}
                  value={values.frontWidthFt ?? ""}
                  onChange={(e) => update("frontWidthFt", e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-shop-depth">Shop depth (ft)</label>
                <input
                  id="pf-shop-depth"
                  type="number"
                  min={0}
                  value={values.shopDepthFt ?? ""}
                  onChange={(e) => update("shopDepthFt", e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-road-width">Road width (ft)</label>
                <input
                  id="pf-road-width"
                  type="number"
                  min={0}
                  value={values.roadWidthFt ?? ""}
                  onChange={(e) => update("roadWidthFt", e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-power-load">Power load</label>
                <input
                  id="pf-power-load"
                  type="text"
                  maxLength={60}
                  placeholder="Example: 5 kW / 3-phase"
                  value={values.powerLoad ?? ""}
                  onChange={(e) => update("powerLoad", e.target.value === "" ? undefined : e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pf-corner-shop">Corner shop</label>
                <select
                  id="pf-corner-shop"
                  value={values.isCornerShop === undefined ? "" : values.isCornerShop ? "yes" : "no"}
                  onChange={(e) => update("isCornerShop", e.target.value === "" ? undefined : e.target.value === "yes")}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pf-washroom">Washroom</label>
                <select
                  id="pf-washroom"
                  value={values.hasWashroom === undefined ? "" : values.hasWashroom ? "yes" : "no"}
                  onChange={(e) => update("hasWashroom", e.target.value === "" ? undefined : e.target.value === "yes")}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pf-ready-to-move">Ready to move</label>
                <select
                  id="pf-ready-to-move"
                  value={values.readyToMove === undefined ? "" : values.readyToMove ? "yes" : "no"}
                  onChange={(e) => update("readyToMove", e.target.value === "" ? undefined : e.target.value === "yes")}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </>
          )}
        </div>
        {isShop && (
          <div className="field" style={{ marginTop: "var(--space-4, 1rem)" }}>
            <label>Suitable for</label>
            <div className="checkbox-grid">
              {SUITABLE_FOR_KEYS.map((tag) => (
                <label key={tag} className="checkbox-tile">
                  <input
                    type="checkbox"
                    checked={(values.suitableFor ?? []).includes(tag)}
                    onChange={() => toggleSuitableFor(tag)}
                  />
                  {tag.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <h2>Location</h2>
        {geoError ? <div className="alert alert--error">{geoError}</div> : null}

        {/* Phase 2 Part 1: PIN Code first -- see AddPropertyPage.tsx's
            Address step for the full rationale. Auto-fills Country/State/
            District/City/Locality below via lookupPostalCode. */}
        <div className="field">
          <label htmlFor="pf-postal-code">
            PIN code <RequiredMark />
          </label>
          <input
            id="pf-postal-code"
            required
            inputMode="numeric"
            maxLength={isIndianAddress ? 6 : 20}
            value={values.location.postalCode ?? ""}
            onChange={handlePostalCodeChange}
            onBlur={() => setPostalCodeTouched(true)}
          />
          {isIndianAddress && postalCodeTouched && postalCodeInvalid ? (
            <span className="field-error">PIN code should be 6 digits.</span>
          ) : pinLookupStatus === "loading" ? (
            <span className="field-hint">Looking up this PIN code...</span>
          ) : pinLookupStatus === "error" && pinLookupError ? (
            <span className="field-error">{pinLookupError}</span>
          ) : pinLookupStatus === "success" ? (
            <span className="field-hint">Location found -- check the map below and adjust the pin if needed.</span>
          ) : (
            <span className="field-hint">{isIndianAddress ? "6-digit Indian PIN code" : "Postal / ZIP code"}</span>
          )}
        </div>

        {localityOptions.length > 1 ? (
          <div className="field">
            <label htmlFor="pf-locality-choice">Which locality?</label>
            <select
              id="pf-locality-choice"
              value={selectedLocalityIndex ?? ""}
              onChange={(e) => selectLocalityOption(Number(e.target.value))}
            >
              <option value="" disabled>
                Select the matching locality
              </option>
              {localityOptions.map((option, index) => (
                <option key={`${option.locality ?? option.formattedAddress}-${index}`} value={index}>
                  {option.locality ?? option.formattedAddress}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="pf-address">
            Address Line <RequiredMark />
          </label>
          <input
            id="pf-address"
            required
            minLength={5}
            value={values.location.addressLine}
            onChange={(e) => updateLocation("addressLine", e.target.value)}
            placeholder="Building name / Apartment / Shop name / House number"
          />
          <span className="field-hint">Building name, apartment, shop name, or house number.</span>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="pf-locality">Locality</label>
            <input id="pf-locality" readOnly value={values.location.locality ?? ""} placeholder="Auto-filled from PIN code" />
          </div>
          <div className="field">
            {/* Bug fix (same production bug as AddPropertyPage.tsx's wizard
                Address step -- see that file's comment on w-city for the
                full rationale): PIN-code geocoding doesn't always resolve a
                city, and the backend hard-requires location.city to be at
                least 2 characters. This field was permanently readOnly with
                no onChange, so there was no way to fix that on Edit either.
                Now genuinely editable (still auto-fills the same way when
                geocoding succeeds); required/minLength mirror the existing
                native-HTML5-validation pattern already used by pf-address
                above rather than introducing a new inline-error style. */}
            <label htmlFor="pf-city">
              City <RequiredMark />
            </label>
            <input
              id="pf-city"
              required
              minLength={2}
              value={values.location.city}
              onChange={(e) => updateLocation("city", e.target.value)}
              placeholder="Auto-filled from PIN code -- edit if missing or incorrect"
            />
          </div>
          <div className="field">
            <label htmlFor="pf-district">District</label>
            <input id="pf-district" readOnly value={values.location.district ?? ""} placeholder="Auto-filled from PIN code" />
          </div>
          <div className="field">
            <label htmlFor="pf-state">State</label>
            <input id="pf-state" readOnly value={values.location.state ?? ""} placeholder="Auto-filled from PIN code" />
          </div>
          <div className="field">
            <label htmlFor="pf-country">Country</label>
            <input id="pf-country" readOnly value={values.location.country ?? ""} placeholder="Auto-filled from PIN code" />
          </div>
        </div>

        <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={useCurrentLocation}>
          Use current location
        </button>
        {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}

        {pinLookupStatus === "success" || pinLookupStatus === "error" || values.location.latitude !== undefined ? (
          <div className="field">
            <label>Map location {reverseGeocoding ? <span className="field-hint">(updating address...)</span> : null}</label>
            <Suspense fallback={<p className="field-hint">Loading map...</p>}>
              <AddressMap
                position={
                  values.location.latitude !== undefined && values.location.longitude !== undefined
                    ? [values.location.latitude, values.location.longitude]
                    : INDIA_CENTER
                }
                onMarkerMove={handleMarkerMove}
              />
            </Suspense>
            <span className="field-hint">Drag the pin to set your exact location.</span>
          </div>
        ) : (
          <p className="field-hint">Enter a PIN code above or use current location to show the map and place a marker.</p>
        )}
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
