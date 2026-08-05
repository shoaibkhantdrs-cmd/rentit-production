import { ChangeEvent, ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  Eye,
  FileText,
  IndianRupee,
  MapPin,
  Rocket,
  Save,
  Sparkles,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { useAuth } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/EmptyState";
import { ImageUploadManager } from "@/components/ImageUploadManager";
import { PropertyCard } from "@/components/PropertyCard";
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
} from "@/api/types";
import { ApiError } from "@/api/httpClient";
import { Chip } from "@/components/ui/Chip";
import { formatCurrency } from "@/utils/format";
import { lazyNamed } from "@/utils/lazyNamed";

// Perf: same lazy-loading approach already used for the Search page's map
// view (ResultsMap) -- Leaflet/react-leaflet only ever load when the
// Address step actually needs to show a map, not in every visitor's main
// bundle.
const AddressMap = lazyNamed<typeof import("@/components/AddressMap").AddressMap>(
  () => import("@/components/AddressMap"),
  "AddressMap",
);

// Geographic center of India -- used as the map's starting position only
// when a PIN lookup fails and there's no other coordinate yet, so the user
// can still drag the marker to their real location by hand instead of
// being stuck with no map at all.
const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

const PROPERTY_TYPES: PropertyType[] = ["apartment", "house", "villa", "studio", "pg", "room", "commercial", "shop", "other"];
const FACINGS: Facing[] = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"];
const FURNISHED: FurnishedStatus[] = ["unfurnished", "semi_furnished", "fully_furnished"];

// Requested order was Basic -> Address -> Photos -> Amenities -> Pricing ->
// Preview -> Publish. Photos moved to come after Pricing here for a real
// reason, not a stylistic one: photo upload hits POST /properties/:id/images,
// which requires a property to already exist server-side. Every other field
// needed by the create endpoint (title, category, address, rent, area,
// availableFrom) has to be collected first, so the draft is created the
// moment the user reaches the Photos step -- this is documented, not hidden.
const STEPS = ["Basic details", "Address", "Amenities", "Pricing & size", "Photos", "Preview", "Publish"] as const;

const STEP_ICONS = [FileText, MapPin, Sparkles, IndianRupee, Camera, Eye, Rocket];

const STEP_HELP = [
  "Give renters a clear, honest picture of the property -- a good title and description drive far more enquiries.",
  "Where is this property? Accurate location is the single biggest factor in whether renters find it.",
  "Select the amenities this property actually has -- only tick what's real.",
  "Set your rent, deposit, and the property's specs.",
  "Real photos -- listings with photos get far more views than ones without.",
  "Double check everything looks right before you publish.",
  "Go live now, or save your draft and publish later from My Properties.",
];

function StepHeading({ title, stepIndex }: { title: ReactNode; stepIndex: number }) {
  const Icon = STEP_ICONS[stepIndex];
  return (
    <div className="wizard-step-heading">
      <span className="wizard-step-heading__icon">
        <Icon size={22} />
      </span>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="wizard-step-heading__help">{STEP_HELP[stepIndex]}</p>
      </div>
    </div>
  );
}

// Visible required-field marker. The wizard used to rely purely on the
// Next button silently staying disabled until a required field passed
// validation, with no on-screen indication of *which* fields were
// required at all -- fine once you already know the rules, not fine for
// a first-time user. Kept as an inline style (not a new index.css class)
// so this change stays self-contained to this file's own diff.
function RequiredMark() {
  return (
    <span aria-hidden="true" style={{ color: "var(--color-danger, #dc2626)" }}>
      *
    </span>
  );
}

type WizardValues = CreatePropertyPayload;

const DRAFT_KEY = "rentit:add-property-draft";

function initialValues(): WizardValues {
  return {
    title: "",
    description: "",
    categoryId: "",
    propertyType: "apartment",
    rentAmount: 0,
    securityDeposit: 0,
    areaSqft: 0,
    // Bedrooms/bathrooms used to default to 1 -- changed to 0 (matching the
    // backend's own `.default(0)` in createPropertySchema) so the Pricing &
    // size step can render these fields empty on a fresh draft instead of
    // pre-filling a value the user never chose. 0 remains a perfectly valid
    // submission value (a studio has 0 separate bedrooms), same as before.
    bedrooms: 0,
    bathrooms: 0,
    parkingSpaces: 0,
    furnishedStatus: "unfurnished",
    availableFrom: new Date().toISOString().slice(0, 10),
    features: [],
    // Country defaults to "India" (this platform is India-only in practice
    // -- every other field/currency on this page assumes it) but stays a
    // plain editable text input, not a locked value.
    location: { addressLine: "", city: "", state: "", country: "India", postalCode: "" },
  };
}

function loadDraft(): WizardValues {
  const fresh = initialValues();
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return fresh;
    // Bug fix: this used to be `{ ...initialValues(), ...JSON.parse(raw) }`
    // -- an untyped, unchecked *shallow* merge of whatever the parsed JSON
    // happened to contain. Because `location` is itself an object, that
    // shallow spread let a saved draft's entire `location` sub-object
    // wholesale-replace the fresh one, silently carrying forward any
    // field -- extra/renamed keys, values from a since-removed input, a
    // manually-edited localStorage entry -- with zero validation and zero
    // corresponding UI to see or clear it. This is precisely how a value
    // the current form can't produce (e.g. a stray non-address word, or a
    // stale addressLine typed out in full because State/PIN/Country inputs
    // didn't exist yet) could resurface indefinitely on every future visit
    // to this page and get silently resubmitted.
    //
    // Fix: parse into `unknown` and explicitly pick only the known,
    // currently-supported top-level and location fields, each individually
    // type/shape-checked. Anything else in the stored JSON (extra keys,
    // wrong types, fields from a form that no longer exists) is dropped on
    // load rather than carried forward forever.
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fresh;
    const draft = parsed as Partial<WizardValues> & { location?: Partial<WizardValues["location"]> };
    // Explicit annotation is load-bearing here, not decoration: without it,
    // TS infers this ternary's type as `{}` (the widest common supertype
    // of `Partial<...>` and the empty-object literal fallback) rather than
    // `Partial<WizardValues["location"]>`, which silently made every
    // property access below a compile error under `tsc -b` (the project's
    // real build command) -- a gap this file's own `npx tsc --noEmit -p
    // tsconfig.json` sandbox checks never caught, because that root
    // tsconfig has `"files": []` and just references sub-projects, so it
    // was checking zero files the whole time. `tsc -b` / `tsc --noEmit -p
    // tsconfig.app.json` is the check that actually exercises this code.
    const draftLocation: Partial<WizardValues["location"]> =
      draft.location && typeof draft.location === "object" ? draft.location : {};

    const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
    const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

    return {
      ...fresh,
      ...draft,
      location: {
        addressLine: str(draftLocation.addressLine) ?? fresh.location.addressLine,
        city: str(draftLocation.city) ?? fresh.location.city,
        locality: str(draftLocation.locality),
        district: str(draftLocation.district),
        state: str(draftLocation.state) ?? fresh.location.state,
        country: str(draftLocation.country) ?? fresh.location.country,
        postalCode: str(draftLocation.postalCode) ?? fresh.location.postalCode,
        latitude: num(draftLocation.latitude),
        longitude: num(draftLocation.longitude),
      },
    };
  } catch {
    return fresh;
  }
}

// Bug fix (property-owner-role follow-up): UpdateProperty.usecase.ts only
// ever allowed admin/super_admin to set status: "published" directly
// (ForbiddenError "Only an admin can publish a listing. Submit it for
// review instead.") -- that's an intentional anti-abuse check (RC1 Fix #2:
// a property_owner could otherwise self-publish a never-reviewed listing,
// or un-hide one an admin had set "inactive"). The backend's intended
// non-admin path is PATCH { status: "pending_review" } followed by an
// admin approval (ApproveProperty.usecase.ts / POST
// /admin/properties/:id/approve), but this page's Publish step never
// exposed that -- it only ever called status: "published", so every
// non-admin owner's "Publish now" click was guaranteed to 403 with no
// way to proceed. ADMIN_ROLES/isAdmin below let this step show the
// correct action for each role instead.
const ADMIN_ROLES = ["admin", "super_admin"];

function PropertyWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.includes(role)) ?? false;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(loadDraft);
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [createdProperty, setCreatedProperty] = useState<PropertyDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Geocoding failures are a distinct, address-specific error: shown only
  // on the Address step (not the generic top-of-wizard createError banner),
  // auto-cleared the moment the user edits any address field (see
  // updateAddressField), and "retried" simply by the user continuing the
  // wizard again with the corrected address -- goNext's create call is
  // re-run from scratch with whatever is currently in `values`, so there's
  // no separate stale request to invalidate.
  const [geoError, setGeoError] = useState<string | null>(null);
  // Phase 2 Part 1 (PIN-first Address step) state.
  const [pinLookupStatus, setPinLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pinLookupError, setPinLookupError] = useState<string | null>(null);
  const [localityOptions, setLocalityOptions] = useState<PostalCodeLookupResult[]>([]);
  const [selectedLocalityIndex, setSelectedLocalityIndex] = useState<number | null>(null);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [submittedForReview, setSubmittedForReview] = useState(false);

  // Pricing & size step: rentAmount/securityDeposit/areaSqft/bedrooms/
  // bathrooms/parkingSpaces are required `number` fields on WizardValues
  // (CreatePropertyPayload), so they can't be `undefined` the way
  // floorNumber/totalFloors already are -- that would change the shared
  // API payload type. Instead each field gets its own display-only text
  // state, decoupled from the committed numeric value: it starts blank
  // (even though the underlying value defaults to 0), only ever contains
  // digits the user actually typed, and is what the input's `value` prop
  // renders. This means the visible field is never pre-filled with a "0"
  // the user has to notice and delete, while `values.<field>` stays a
  // real number the rest of the app (goNext's create call) already
  // expects. Initialized from any restored localStorage draft so a
  // returning user still sees what they previously typed.
  const [rentText, setRentText] = useState(values.rentAmount ? String(values.rentAmount) : "");
  const [depositText, setDepositText] = useState(values.securityDeposit ? String(values.securityDeposit) : "");
  const [areaText, setAreaText] = useState(values.areaSqft ? String(values.areaSqft) : "");
  const [bedroomsText, setBedroomsText] = useState(values.bedrooms ? String(values.bedrooms) : "");
  const [bathroomsText, setBathroomsText] = useState(values.bathrooms ? String(values.bathrooms) : "");
  const [parkingText, setParkingText] = useState(values.parkingSpaces ? String(values.parkingSpaces) : "");

  // Pricing & size validation now happens only when Next is clicked (see
  // goNext), with inline messages here instead of a silently-disabled
  // button -- the same silent-disable pattern that caused the Step 0
  // Next-button bug is exactly what this avoids for Step 3.
  const [step3Errors, setStep3Errors] = useState<Partial<Record<"rentAmount" | "areaSqft" | "availableFrom", string>>>({});

  useEffect(() => {
    // Bug fix (QA report #8): a failed fetch used to silently resolve to
    // an empty category list with no explanation. Step 0's validation
    // requires a category to be selected, so this left the user stuck on
    // step 1 with an empty dropdown and "Next" permanently disabled, and
    // no way to know why. Matches the same fetch + error pattern already
    // used by PropertyForm.tsx.
    propertiesApi
      .categories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategoriesError("Could not load categories. Refresh the page to try again."));
  }, []);

  // Auto-save draft -- but only before the property actually exists
  // server-side; once created, the draft *is* the server record, so
  // continuing to shadow it in localStorage would just be stale data.
  useEffect(() => {
    if (createdProperty) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  }, [values, createdProperty]);

  const update = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateLocation = <K extends keyof WizardValues["location"]>(key: K, value: WizardValues["location"][K]) =>
    setValues((prev) => ({ ...prev, location: { ...prev.location, [key]: value } }));

  // Under the Phase 2 Part 1 PIN-first flow, the PIN code field is the only
  // remaining field where an edit should invalidate the marker: Country/
  // State/District/City/Locality are now auto-filled (never manually
  // typed, see spec item 5) and Address Line is just descriptive text
  // (building/apartment/shop name, spec item 6) that was never used for
  // geocoding to begin with. So unlike the old flow, this wrapper clears
  // latitude/longitude only for the PIN code -- editing the PIN
  // invalidates whatever location the old PIN resolved to, until the new
  // PIN's lookup (handlePostalCodeChange) resolves a fresh one. Kept as a
  // generic-key helper (rather than inlining into handlePostalCodeChange)
  // in case a future field needs the same treatment.
  const updateAddressField = <K extends keyof WizardValues["location"]>(key: K, value: WizardValues["location"][K]) => {
    setValues((prev) => ({
      ...prev,
      location: { ...prev.location, [key]: value, latitude: undefined, longitude: undefined },
    }));
    setGeoStatus(null);
    // A geocoding failure is specific to the address that produced it --
    // any further edit means it's no longer the same request, so the old
    // error is stale and would be actively misleading if left on screen.
    setGeoError(null);
  };

  const toggleFeature = (feature: string) =>
    setValues((prev) => {
      const current = prev.features ?? [];
      return { ...prev, features: current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature] };
    });

  const digitsOnly = (raw: string) => raw.replace(/[^0-9]/g, "");

  // Shared onChange for the six Pricing & size numeric fields: strips
  // anything that isn't a digit (so users can only ever type digits, per
  // spec), keeps the field's own display text in sync, and updates the
  // real numeric value used by the create-property payload. Clears that
  // field's step3Errors entry the moment it's no longer empty, so the
  // error disappears as soon as it's fixed rather than lingering until
  // the next Next click.
  const handleNumericField =
    (
      setText: (v: string) => void,
      key: "rentAmount" | "securityDeposit" | "areaSqft" | "bedrooms" | "bathrooms" | "parkingSpaces",
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const digits = digitsOnly(e.target.value);
      setText(digits);
      update(key, digits === "" ? 0 : Number(digits));
      if (key === "rentAmount" || key === "areaSqft") {
        setStep3Errors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
      }
    };

  // Mirrors NominatimGeocodingService's own India-detection heuristic
  // (backend/src/infrastructure/maps/NominatimGeocodingService.ts) so the
  // PIN code field's format hint/validation matches what the backend will
  // actually treat as an Indian address -- an unset country defaults to
  // "India" the same way it does there.
  const isIndianAddress = (() => {
    const normalized = (values.location.country ?? "").trim().toLowerCase();
    return !normalized || normalized === "india" || normalized === "in";
  })();

  const [postalCodeTouched, setPostalCodeTouched] = useState(false);
  const postalCodeInvalid = Boolean(values.location.postalCode) && values.location.postalCode!.length !== 6;

  // Applies a resolved PIN-lookup/reverse-geocode result's address fields
  // (country/state/district/city/locality) WITHOUT touching
  // latitude/longitude or addressLine -- used by the marker-drag path
  // (handleMarkerMove), which already owns the new coordinates directly
  // from the drag event and must not let a slightly different
  // reverse-geocoded coordinate silently override them.
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

  // Applies a resolved result's address fields AND places the marker at its
  // coordinates -- used by the PIN-lookup and "Use current location" paths,
  // where the coordinates are new information rather than something the
  // user just set directly.
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

  // Triggered once the PIN code field reaches exactly 6 digits (Indian
  // addresses only -- see handlePostalCodeChange below). A single result
  // resolves and places the marker immediately; multiple candidate
  // localities for the same PIN show a dropdown (per spec item 4) and wait
  // for the user to pick one before placing the marker.
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
      // Multiple localities for the same PIN -- show the dropdown, don't
      // guess. Auto-fill Country/State/District/City from the first
      // candidate (those fields are typically identical across all
      // candidates for one PIN) but leave locality/coordinates for the
      // user's explicit choice.
      setLocalityOptions(res.items);
      applyAddressFields(res.items[0]);
      setPinLookupStatus("success");
    } catch (err) {
      setPinLookupStatus("error");
      setPinLookupError(err instanceof ApiError ? err.message : "Could not look up this PIN code. Please try again.");
    }
  };

  // PIN code gets its own handler (rather than a plain updateAddressField
  // call) so it can restrict input the same way the Pricing & size step's
  // numeric fields already do (digitsOnly, defined above): only digits are
  // ever accepted while the address looks Indian, capped at 6 characters
  // since Indian PIN codes are always exactly 6 digits. Non-Indian
  // addresses fall back to free text (many countries use alphanumeric
  // postal codes), capped at the backend's own 20-character limit. Any
  // edit clears the previous lookup's locality options/status/error --
  // they belong to the previous PIN, not this one -- and once the field
  // reaches exactly 6 digits (Indian addresses), the lookup fires
  // automatically per spec item 3.
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

  // User's explicit choice from the multi-locality dropdown (spec item 4):
  // applies that specific candidate's full address + coordinates and
  // places the marker there.
  const selectLocalityOption = (index: number) => {
    const resolved = localityOptions[index];
    if (!resolved) return;
    setSelectedLocalityIndex(index);
    applyResolvedLocation(resolved);
  };

  // Marker-drag handler (spec items 9-10): the dragged-to coordinates are
  // authoritative the instant the drag ends -- set them immediately so the
  // map/marker never visually snaps back -- then reverse-geocode in the
  // background to refresh the text address fields to match. If reverse
  // geocoding fails, the coordinates the user actually placed the marker
  // at are kept as-is; only the text fields are left showing whatever they
  // had before.
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
      // Non-fatal: the marker position (already applied above) remains the
      // source of truth even if we couldn't refresh the text fields.
    } finally {
      setReverseGeocoding(false);
    }
  };

  // "Use current location" (spec items 11-12): get GPS coordinates, place
  // the marker immediately (same immediate-then-refine pattern as
  // handleMarkerMove), then reverse-geocode to auto-fill the address
  // fields. Falls back gracefully -- keeping the coordinates even if
  // reverse geocoding fails -- so the user can still finish the address
  // fields (or the marker alone) by hand.
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

  const locked = createdProperty !== null; // steps 0-3 become read-only once the draft is created server-side

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return values.title.trim().length >= 5 && values.description.trim().length >= 20 && !!values.categoryId;
      // Phase 2 Part 1 validation (spec item 13): PIN required, Address
      // Line required, and a marker must be placed (latitude/longitude
      // both set) before the user can continue -- either from a resolved
      // PIN lookup, a dragged marker, or "Use current location".
      case 1:
        return (
          Boolean(values.location.postalCode?.trim()) &&
          values.location.addressLine.trim().length >= 5 &&
          values.location.latitude !== undefined &&
          values.location.longitude !== undefined
        );
      // case 3 (Pricing & size) intentionally omitted: that step is no
      // longer gated by a silently-disabled Next button. Falls through to
      // `default: true` below, and goNext() validates it explicitly on
      // click instead, showing inline field-error messages for whatever
      // is actually missing -- see the step === 3 block in goNext.
      default:
        return true;
    }
  }, [step, values]);

  const goNext = async () => {
    if (step === 3) {
      const errors: typeof step3Errors = {};
      if (!rentText.trim()) errors.rentAmount = "Monthly rent is required.";
      if (!areaText.trim()) errors.areaSqft = "Area is required.";
      if (!values.availableFrom) errors.availableFrom = "Available-from date is required.";
      setStep3Errors(errors);
      if (Object.keys(errors).length > 0) return;
    } else if (!stepValid) {
      return;
    }
    // Entering the Photos step for the first time is when the real draft
    // gets created -- everything the backend requires has been collected.
    if (step === 3 && !createdProperty) {
      setCreating(true);
      setCreateError(null);
      setGeoError(null);
      try {
        const result = await propertiesApi.create(values);
        setCreatedProperty(result);
        localStorage.removeItem(DRAFT_KEY);
        setStep(step + 1);
      } catch (err) {
        // Geocoding failures are the one create-time error that's actually
        // about a specific step (Address) rather than the submission as a
        // whole -- CreatePropertyUseCase only ever throws a
        // VALIDATION_ERROR from *within* the create flow (after the
        // request body has already passed Zod schema validation) when
        // NominatimGeocodingService couldn't resolve a location; every
        // other create-time failure is a generic VALIDATION_ERROR from
        // pre-request payload validation, a NOT_FOUND for an unknown
        // category, or something unrelated. Route those specifically back
        // to the Address step and show them there instead of the generic
        // top-of-wizard banner, so the error appears next to the fields
        // that actually need fixing. It clears itself the instant any
        // address field changes (updateAddressField), and "retrying" is
        // just completing the wizard again -- this same catch block reruns
        // geocoding from whatever is currently in `values` every time.
        const isGeocodingFailure =
          err instanceof ApiError && err.code === "VALIDATION_ERROR" && /geocod|resolve a location/i.test(err.message);
        if (isGeocodingFailure) {
          setGeoError(err.message);
          setStep(1);
        } else {
          setCreateError(err instanceof ApiError ? err.message : "Could not save this listing. Please try again.");
        }
      } finally {
        setCreating(false);
      }
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handlePublish = async () => {
    if (!createdProperty) return;
    setPublishing(true);
    try {
      await propertiesApi.update(createdProperty.id, { status: "published" });
      setPublished(true);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not publish this listing.");
    } finally {
      setPublishing(false);
    }
  };

  // Non-admin counterpart to handlePublish -- see ADMIN_ROLES comment
  // above for why this exists. Same status-transition endpoint, different
  // target status, which UpdateProperty.usecase.ts allows for any owner.
  const handleSubmitForReview = async () => {
    if (!createdProperty) return;
    setPublishing(true);
    try {
      await propertiesApi.update(createdProperty.id, { status: "pending_review" });
      setSubmittedForReview(true);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not submit this listing for review.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>List a property</h1>
          <p>A few quick steps -- your progress is saved automatically as you go.</p>
        </div>
      </div>

      <div className="wizard-progress">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`wizard-progress__step${i < step ? " wizard-progress__step--done" : ""}${i === step ? " wizard-progress__step--active" : ""}`}
          >
            <div className="wizard-progress__bar">
              <div className="wizard-progress__bar-fill" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
            <span className="wizard-progress__dot">{i < step ? <Check size={14} /> : i + 1}</span>
            <span className="wizard-progress__label">{label}</span>
          </div>
        ))}
      </div>

      <div className="wizard-card">
        {createError ? <div className="alert alert--error">{createError}</div> : null}

      <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {step === 0 && (
          <div className="form-section">
            <StepHeading title="Basic details" stepIndex={0} />
            {locked ? <p className="field-hint">Saved -- edit these later from My Properties.</p> : null}
            <div className="field">
              <label htmlFor="w-title">Title</label>
              <input id="w-title" required minLength={5} maxLength={200} disabled={locked} value={values.title} onChange={(e) => update("title", e.target.value)} />
              {/* Bug fix: stepValid (below) silently requires title.trim() >= 5
                  chars before Next enables, but nothing on screen said so --
                  the HTML `required`/`minLength` attributes above never
                  surface native validation because Next is a plain button,
                  not a form submit. Reusing the same field-error pattern
                  already used for categoriesError just above. */}
              {!locked && values.title.trim().length > 0 && values.title.trim().length < 5 ? (
                <span className="field-error">Title must be at least 5 characters ({values.title.trim().length}/5).</span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="w-description">Description</label>
              <textarea id="w-description" required minLength={20} maxLength={5000} disabled={locked} value={values.description} onChange={(e) => update("description", e.target.value)} />
              {!locked && values.description.trim().length > 0 && values.description.trim().length < 20 ? (
                <span className="field-error">Description must be at least 20 characters ({values.description.trim().length}/20).</span>
              ) : null}
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="w-category">Category</label>
                <select id="w-category" required disabled={locked} value={values.categoryId} onChange={(e) => update("categoryId", e.target.value)}>
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categoriesError ? <span className="field-error">{categoriesError}</span> : null}
              </div>
              <div className="field">
                <label>Property type</label>
                <div className="chip-row">
                  {PROPERTY_TYPES.map((t) => (
                    <Chip key={t} active={values.propertyType === t} onClick={() => !locked && update("propertyType", t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-section">
            <StepHeading title="Address" stepIndex={1} />
            {locked ? <p className="field-hint">Saved -- edit these later from My Properties.</p> : null}
            {/* Geocoding failures are address-specific, so they're surfaced
                only here on the Address step (never the generic top-of-wizard
                createError banner) -- see goNext's create-catch block, which
                routes the user back to this step when this happens. Cleared
                automatically the instant the PIN changes (updateAddressField)
                or a marker move/current-location lookup succeeds, and
                implicitly "retried" the next time the user completes the
                wizard again with the corrected address -- no separate retry
                action needed. */}
            {geoError ? <div className="alert alert--error">{geoError}</div> : null}

            {/* Phase 2 Part 1: PIN Code is the first required field (spec
                item 2) -- entering a valid 6-digit Indian PIN triggers an
                automatic lookup (handlePostalCodeChange) that auto-fills
                Country/State/District/City/Locality below, so the user never
                has to type them by hand (spec item 5). */}
            <div className="field">
              <label htmlFor="w-postal-code">
                PIN code <RequiredMark />
              </label>
              <input
                id="w-postal-code"
                required
                disabled={locked}
                inputMode="numeric"
                maxLength={isIndianAddress ? 6 : 20}
                value={values.location.postalCode ?? ""}
                onChange={handlePostalCodeChange}
                onBlur={() => setPostalCodeTouched(true)}
                placeholder="e.g. 226028"
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

            {/* Multiple localities can share one PIN code -- shown only when
                the lookup actually returned more than one candidate (spec
                item 4). Picking an option re-applies that candidate's full
                address + coordinates and moves the marker. */}
            {!locked && localityOptions.length > 1 ? (
              <div className="field">
                <label htmlFor="w-locality-choice">Which locality?</label>
                <select
                  id="w-locality-choice"
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
              <label htmlFor="w-address">
                Address Line <RequiredMark />
              </label>
              <input
                id="w-address"
                required
                minLength={5}
                disabled={locked}
                value={values.location.addressLine}
                onChange={(e) => updateLocation("addressLine", e.target.value)}
                placeholder="e.g. Flat 4B, Rolex Estate / Shop No. 12 / House No. 45"
              />
              <span className="field-hint">Building name, apartment, shop name, or house number.</span>
              {!locked && values.location.addressLine.trim().length > 0 && values.location.addressLine.trim().length < 5 ? (
                <span className="field-error">Address line must be at least 5 characters ({values.location.addressLine.trim().length}/5).</span>
              ) : null}
            </div>

            {/* Country/State/District/City are auto-filled only -- never
                manually typed (spec item 5). Read-only rather than removed
                entirely so the user can see and trust what was resolved. */}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="w-locality">Locality</label>
                <input id="w-locality" readOnly disabled={locked} value={values.location.locality ?? ""} placeholder="Auto-filled from PIN code" />
              </div>
              <div className="field">
                <label htmlFor="w-city">City</label>
                <input id="w-city" readOnly disabled={locked} value={values.location.city} placeholder="Auto-filled from PIN code" />
              </div>
              <div className="field">
                <label htmlFor="w-district">District</label>
                <input id="w-district" readOnly disabled={locked} value={values.location.district ?? ""} placeholder="Auto-filled from PIN code" />
              </div>
              <div className="field">
                <label htmlFor="w-state">State</label>
                <input id="w-state" readOnly disabled={locked} value={values.location.state ?? ""} placeholder="Auto-filled from PIN code" />
              </div>
              <div className="field">
                <label htmlFor="w-country">Country</label>
                <input id="w-country" readOnly disabled={locked} value={values.location.country ?? ""} placeholder="Auto-filled from PIN code" />
              </div>
            </div>

            {!locked ? (
              <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={useCurrentLocation}>
                <MapPin size={14} /> Use current location
              </button>
            ) : null}
            {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}

            {/* Interactive map (spec items 7-10): appears as soon as a
                marker position exists -- a successful PIN lookup, "Use
                current location", or (once shown) a drag -- and lets the
                user drag the marker to correct it, reverse-geocoding on
                every drop to keep the text fields in sync. */}
            {!locked && (pinLookupStatus === "success" || pinLookupStatus === "error" || values.location.latitude !== undefined) ? (
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
                <span className="field-hint">Drag the pin to set your exact location -- required before continuing.</span>
              </div>
            ) : !locked ? (
              <p className="field-hint">Enter a PIN code above or use current location to show the map and place a marker.</p>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="form-section">
            <StepHeading title="Amenities" stepIndex={2} />
            {locked ? <p className="field-hint">Saved -- edit these later from My Properties.</p> : null}
            <div className="chip-row">
              {PROPERTY_FEATURE_KEYS.map((feature) => (
                <Chip key={feature} active={(values.features ?? []).includes(feature)} onClick={() => !locked && toggleFeature(feature)}>
                  {feature.replace(/_/g, " ")}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-section">
            <StepHeading title="Pricing & size" stepIndex={3} />
            {locked ? <p className="field-hint">Saved -- edit these later from My Properties.</p> : null}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="w-rent">Monthly rent (₹)</label>
                <div className="input-group">
                  <span className="input-group__prefix" aria-hidden="true">₹</span>
                  <input
                    id="w-rent"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Example: 25000"
                    disabled={locked}
                    value={rentText}
                    onChange={handleNumericField(setRentText, "rentAmount")}
                  />
                </div>
                {step3Errors.rentAmount ? <span className="field-error">{step3Errors.rentAmount}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="w-deposit">Security deposit (₹)</label>
                <div className="input-group">
                  <span className="input-group__prefix" aria-hidden="true">₹</span>
                  <input
                    id="w-deposit"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Example: 50000"
                    disabled={locked}
                    value={depositText}
                    onChange={handleNumericField(setDepositText, "securityDeposit")}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="w-area">Area (sqft)</label>
                <input
                  id="w-area"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Example: 1200"
                  disabled={locked}
                  value={areaText}
                  onChange={handleNumericField(setAreaText, "areaSqft")}
                />
                {step3Errors.areaSqft ? <span className="field-error">{step3Errors.areaSqft}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="w-available">Available from</label>
                <input id="w-available" type="date" required disabled={locked} value={values.availableFrom} onChange={(e) => update("availableFrom", e.target.value)} />
                {step3Errors.availableFrom ? <span className="field-error">{step3Errors.availableFrom}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="w-bedrooms">Bedrooms</label>
                <input
                  id="w-bedrooms"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Example: 2"
                  disabled={locked}
                  value={bedroomsText}
                  onChange={handleNumericField(setBedroomsText, "bedrooms")}
                />
              </div>
              <div className="field">
                <label htmlFor="w-bathrooms">Bathrooms</label>
                <input
                  id="w-bathrooms"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Example: 2"
                  disabled={locked}
                  value={bathroomsText}
                  onChange={handleNumericField(setBathroomsText, "bathrooms")}
                />
              </div>
              <div className="field">
                <label htmlFor="w-parking">Parking spaces</label>
                <input
                  id="w-parking"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Example: 1"
                  disabled={locked}
                  value={parkingText}
                  onChange={handleNumericField(setParkingText, "parkingSpaces")}
                />
              </div>
              <div className="field">
                <label htmlFor="w-furnished">Furnished status</label>
                <select id="w-furnished" disabled={locked} value={values.furnishedStatus} onChange={(e) => update("furnishedStatus", e.target.value as FurnishedStatus)}>
                  {FURNISHED.map((f) => (
                    <option key={f} value={f}>{f.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="w-floor">Floor number</label>
                <input id="w-floor" type="number" disabled={locked} value={values.floorNumber ?? ""} onChange={(e) => update("floorNumber", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-total-floors">Total floors</label>
                <input id="w-total-floors" type="number" disabled={locked} value={values.totalFloors ?? ""} onChange={(e) => update("totalFloors", e.target.value === "" ? undefined : Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-facing">Facing</label>
                <select id="w-facing" disabled={locked} value={values.facing ?? ""} onChange={(e) => update("facing", (e.target.value || undefined) as Facing | undefined)}>
                  <option value="">Not specified</option>
                  {FACINGS.map((f) => (
                    <option key={f} value={f}>{f.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Bug fix (QA report #5): this block used to have a
            `creating ? ... : createdProperty ? ... : ...` branch whose
            first arm could never render -- `creating` flips back to
            false in the same batch that advances `step` to 4 (see
            goNext above), so `step === 4 && creating` is never true.
            The "Saving..." state during that request is already shown by
            the wizard-footer's Next button (line ~460 below), so the
            dead branch is just removed rather than made reachable. */}
        {step === 4 && (
          createdProperty ? (
            <div className="form-section">
              <StepHeading title="Photos" stepIndex={4} />
              <ImageUploadManager
                propertyId={createdProperty.id}
                images={createdProperty.images}
                onChange={(images) => setCreatedProperty({ ...createdProperty, images })}
              />
            </div>
          ) : (
            <div className="form-section">
              <StepHeading title="Photos" stepIndex={4} />
              <p className="field-hint">Go back and complete pricing &amp; size first.</p>
            </div>
          )
        )}

        {step === 5 && createdProperty && (
          <div className="form-section">
            <StepHeading title="Preview" stepIndex={5} />
            <div style={{ maxWidth: 360 }}>
              <PropertyCard property={createdProperty} showStatus={false} />
            </div>
          </div>
        )}

        {step === 6 && createdProperty && (
          <div className="form-section">
            <StepHeading title="Publish" stepIndex={6} />
            {published ? (
              <>
                <div className="alert alert--success">Your listing is live! Renters can now find it in search.</div>
                <button type="button" className="btn-v2 btn-v2--primary" onClick={() => navigate(`/properties/${createdProperty.id}`)}>
                  View listing
                </button>
              </>
            ) : submittedForReview ? (
              <>
                <div className="alert alert--success">
                  Submitted for review. An admin will publish it shortly -- you'll be notified as soon as it goes live.
                </div>
                <button type="button" className="btn-v2 btn-v2--primary" onClick={() => navigate("/my-properties")}>
                  Go to My Properties
                </button>
              </>
            ) : (
              <>
                <p>
                  {formatCurrency(createdProperty.rentAmount)}/mo &middot; {createdProperty.images.length} photo
                  {createdProperty.images.length === 1 ? "" : "s"} &middot; currently saved as a draft.
                </p>
                {!isAdmin ? (
                  <p className="field-hint">
                    New listings go live after a quick admin review -- submit it now and we'll notify you the moment it's published.
                  </p>
                ) : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {isAdmin ? (
                    <button type="button" className="btn-v2 btn-v2--primary" onClick={handlePublish} disabled={publishing}>
                      {publishing ? "Publishing..." : "Publish now"}
                    </button>
                  ) : (
                    <button type="button" className="btn-v2 btn-v2--primary" onClick={handleSubmitForReview} disabled={publishing}>
                      {publishing ? "Submitting..." : "Submit for review"}
                    </button>
                  )}
                  <button type="button" className="btn-v2 btn-v2--secondary" onClick={() => navigate("/my-properties")}>
                    <Save size={15} /> Finish later (keep as draft)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      {!published && !submittedForReview ? (
        <div className="wizard-footer">
          <button type="button" className="btn-v2 btn-v2--ghost" onClick={goBack} disabled={step === 0 || creating}>
            Back
          </button>
          <span className="wizard-draft-note">
            {createdProperty ? "Draft saved" : "Auto-saving locally"}
          </span>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-v2 btn-v2--primary" onClick={goNext} disabled={!stepValid || creating}>
              {creating ? "Saving..." : "Next"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// RC1 bug fix: the backend's POST /properties route requires the
// property_owner/admin/super_admin role (property.routes.ts), but this
// page was only wrapped in RequireAuth (signed-in check, no role check).
// A signed-in renter-only account could fill out the entire multi-step
// wizard and only discover they're rejected as a 403 at final submit.
// This mirrors the same signed-in-but-not-authorized pattern RequireAdmin
// already uses for /admin/*.
const LISTING_ROLES = ["property_owner", "admin", "super_admin"];

function RequireListingRole({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canList = user?.roles.some((role) => LISTING_ROLES.includes(role)) ?? false;
  if (!canList) {
    return (
      <EmptyState
        icon="🔒"
        title="Listing not available for this account"
        description="Only property-owner accounts can list a property. Contact support if you believe this is a mistake."
      />
    );
  }
  return <>{children}</>;
}

export function AddPropertyPage() {
  return (
    <RequireAuth message="Sign in to list a property.">
      <RequireListingRole>
        <PropertyWizard />
      </RequireListingRole>
    </RequireAuth>
  );
}
