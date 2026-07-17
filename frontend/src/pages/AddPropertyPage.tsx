import { ReactNode, useEffect, useMemo, useState } from "react";
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
  PROPERTY_FEATURE_KEYS,
  PropertyCategory,
  PropertyDetail,
  PropertyType,
} from "@/api/types";
import { ApiError } from "@/api/httpClient";
import { Chip } from "@/components/ui/Chip";
import { formatCurrency } from "@/utils/format";

const PROPERTY_TYPES: PropertyType[] = ["apartment", "house", "villa", "studio", "pg", "room", "commercial", "other"];
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
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    furnishedStatus: "unfurnished",
    availableFrom: new Date().toISOString().slice(0, 10),
    features: [],
    location: { addressLine: "", city: "" },
  };
}

function loadDraft(): WizardValues {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return initialValues();
    return { ...initialValues(), ...JSON.parse(raw) };
  } catch {
    return initialValues();
  }
}

function PropertyWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(loadDraft);
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [createdProperty, setCreatedProperty] = useState<PropertyDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

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

  const toggleFeature = (feature: string) =>
    setValues((prev) => {
      const current = prev.features ?? [];
      return { ...prev, features: current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature] };
    });

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

  const locked = createdProperty !== null; // steps 0-3 become read-only once the draft is created server-side

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return values.title.trim().length >= 5 && values.description.trim().length >= 20 && !!values.categoryId;
      case 1:
        return values.location.addressLine.trim().length >= 5 && values.location.city.trim().length >= 2;
      case 3:
        return values.rentAmount >= 0 && values.areaSqft >= 1 && !!values.availableFrom;
      default:
        return true;
    }
  }, [step, values]);

  const goNext = async () => {
    if (!stepValid) return;
    // Entering the Photos step for the first time is when the real draft
    // gets created -- everything the backend requires has been collected.
    if (step === 3 && !createdProperty) {
      setCreating(true);
      setCreateError(null);
      try {
        const result = await propertiesApi.create(values);
        setCreatedProperty(result);
        localStorage.removeItem(DRAFT_KEY);
        setStep(step + 1);
      } catch (err) {
        setCreateError(err instanceof ApiError ? err.message : "Could not save this listing. Please try again.");
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
            </div>
            <div className="field">
              <label htmlFor="w-description">Description</label>
              <textarea id="w-description" required minLength={20} maxLength={5000} disabled={locked} value={values.description} onChange={(e) => update("description", e.target.value)} />
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
            <div className="field">
              <label htmlFor="w-address">Address</label>
              <input id="w-address" required minLength={5} disabled={locked} value={values.location.addressLine} onChange={(e) => updateLocation("addressLine", e.target.value)} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="w-city">City</label>
                <input id="w-city" required minLength={2} disabled={locked} value={values.location.city} onChange={(e) => updateLocation("city", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="w-locality">Locality</label>
                <input id="w-locality" disabled={locked} value={values.location.locality ?? ""} onChange={(e) => updateLocation("locality", e.target.value || undefined)} />
              </div>
            </div>
            {!locked ? (
              <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={useCurrentLocation}>
                <MapPin size={14} /> Use current location
              </button>
            ) : null}
            {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}
            <p className="field-hint">Leave latitude/longitude blank to have the address geocoded automatically.</p>
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
                <input id="w-rent" type="number" min={0} required disabled={locked} value={values.rentAmount} onChange={(e) => update("rentAmount", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-deposit">Security deposit (₹)</label>
                <input id="w-deposit" type="number" min={0} disabled={locked} value={values.securityDeposit} onChange={(e) => update("securityDeposit", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-area">Area (sqft)</label>
                <input id="w-area" type="number" min={1} required disabled={locked} value={values.areaSqft} onChange={(e) => update("areaSqft", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-available">Available from</label>
                <input id="w-available" type="date" required disabled={locked} value={values.availableFrom} onChange={(e) => update("availableFrom", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="w-bedrooms">Bedrooms</label>
                <input id="w-bedrooms" type="number" min={0} disabled={locked} value={values.bedrooms} onChange={(e) => update("bedrooms", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-bathrooms">Bathrooms</label>
                <input id="w-bathrooms" type="number" min={0} disabled={locked} value={values.bathrooms} onChange={(e) => update("bathrooms", Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w-parking">Parking spaces</label>
                <input id="w-parking" type="number" min={0} disabled={locked} value={values.parkingSpaces} onChange={(e) => update("parkingSpaces", Number(e.target.value))} />
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
            ) : (
              <>
                <p>
                  {formatCurrency(createdProperty.rentAmount)}/mo &middot; {createdProperty.images.length} photo
                  {createdProperty.images.length === 1 ? "" : "s"} &middot; currently saved as a draft.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn-v2 btn-v2--primary" onClick={handlePublish} disabled={publishing}>
                    {publishing ? "Publishing..." : "Publish now"}
                  </button>
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

      {!published ? (
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
