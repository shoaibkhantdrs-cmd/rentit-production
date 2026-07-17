import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bath,
  BedDouble,
  Building2,
  Calculator,
  Calendar,
  Camera,
  Car,
  CloudRain,
  Compass,
  DoorOpen,
  Droplet,
  Dumbbell,
  Eye,
  Flag,
  Flame,
  Fuel,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  PhoneCall,
  Ruler,
  Shield,
  Trash2,
  Trees,
  Wifi,
  Waves,
  Zap,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { chatApi } from "@/api/chat";
import { whatsappApi } from "@/api/whatsapp";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { ImageGallery } from "@/components/ImageGallery";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyDetailSkeleton, PropertyGridSkeleton } from "@/components/Skeletons";
import { ErrorState } from "@/components/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/api/httpClient";
import { formatCurrency } from "@/utils/format";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "duplicate_listing", label: "Duplicate listing" },
  { value: "offensive_content", label: "Offensive content" },
  { value: "already_rented", label: "Already rented" },
  { value: "other", label: "Other" },
];

const AMENITY_ICONS: Record<string, typeof Dumbbell> = {
  gym: Dumbbell,
  swimming_pool: Waves,
  power_backup: Zap,
  lift: Building2,
  security: Shield,
  park: Trees,
  club_house: Building2,
  wifi: Wifi,
  pet_friendly: Compass,
  water_supply: Droplet,
  cctv: Camera,
  fire_safety: Flame,
  intercom: PhoneCall,
  rain_water_harvesting: CloudRain,
  gas_pipeline: Fuel,
  servant_room: DoorOpen,
};

export function PropertyDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { status, data: property, error, reload } = useAsync(() => propertiesApi.getById(id), [id]);
  const recommendations = useAsync(() => propertiesApi.recommendationsForProperty(id), [id]);
  const { showToast } = useToast();

  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [deleting, setDeleting] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [whatsappBusy, setWhatsappBusy] = useState<"contact" | "inquiry" | "share" | "visit" | null>(null);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [showShareForm, setShowShareForm] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [sharePhoneError, setSharePhoneError] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState("");

  if (status === "loading") return <PropertyDetailSkeleton />;

  if (status === "error") {
    const notFound = error.toLowerCase().includes("not found");
    return notFound ? (
      <ErrorState title="Listing not found" message="This property doesn't exist or is no longer available." />
    ) : (
      <ErrorState message={error} onRetry={reload} />
    );
  }

  const isFavorited = favoriteOverride ?? property.isFavorited ?? false;
  const isOwner = isAuthenticated && user?.id === property.owner?.id;
  const isAdmin = isAuthenticated && (user?.roles.includes("admin") || user?.roles.includes("super_admin"));
  const canManage = isOwner || isAdmin;

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      showToast("Sign in to save favorites.", "info");
      return;
    }
    setFavoriteBusy(true);
    try {
      if (isFavorited) {
        await propertiesApi.unfavorite(property.id);
        setFavoriteOverride(false);
        showToast("Removed from favorites", "success");
      } else {
        await propertiesApi.favorite(property.id);
        setFavoriteOverride(true);
        showToast("Saved to favorites", "success");
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not update favorites.", "error");
    } finally {
      setFavoriteBusy(false);
    }
  };

  const submitReport = async () => {
    // RC1 bug fix: this action had no isAuthenticated guard, unlike
    // toggleFavorite/startChat above -- a logged-out visitor could open
    // the report form and submit, only to have the call fail against the
    // backend's auth requirement (POST /properties/:id/report) with a
    // confusing error instead of a clear "sign in" prompt.
    if (!isAuthenticated) {
      showToast("Sign in to report this listing.", "info");
      return;
    }
    setReportStatus("sending");
    try {
      await propertiesApi.report(property.id, reportReason, reportDetails.trim() || undefined);
      setReportStatus("sent");
      showToast("Thanks -- your report has been submitted.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not submit report.", "error");
      setReportStatus("idle");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await propertiesApi.remove(property.id);
      navigate("/my-properties");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not delete this listing.", "error");
      setDeleting(false);
    }
  };

  const startChat = async () => {
    if (!isAuthenticated) {
      showToast("Sign in to message the owner.", "info");
      return;
    }
    if (!property.owner) return;
    setMessageBusy(true);
    try {
      const conversation = await chatApi.startConversation(property.owner.id, property.id);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not start a conversation.", "error");
    } finally {
      setMessageBusy(false);
    }
  };

  const contactOwnerViaWhatsApp = async () => {
    setWhatsappBusy("contact");
    try {
      const res = await whatsappApi.contactOwner(property.id);
      showToast(res.message, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not reach the owner on WhatsApp.", "error");
    } finally {
      setWhatsappBusy(null);
    }
  };

  const submitInquiry = async () => {
    if (!inquiryText.trim()) return;
    setWhatsappBusy("inquiry");
    try {
      const res = await whatsappApi.sendInquiry(property.id, inquiryText.trim());
      showToast(res.message, "success");
      setShowInquiryForm(false);
      setInquiryText("");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send that inquiry.", "error");
    } finally {
      setWhatsappBusy(null);
    }
  };

  // "Schedule a visit" -- there's no visit-booking/calendar system anywhere
  // in the backend, so rather than fabricate one, this reuses the real
  // WhatsApp inquiry endpoint with a pre-filled visit-request message. It's
  // an honest way to give the feature real behavior instead of a dead button.
  const scheduleVisit = async () => {
    setWhatsappBusy("visit");
    try {
      const res = await whatsappApi.sendInquiry(
        property.id,
        "Hi, I'd like to schedule a visit to see this property. What times work for you?",
      );
      showToast(res.message, "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not request a visit.", "error");
    } finally {
      setWhatsappBusy(null);
    }
  };

  // Bug fix (QA report #13): only checked for non-empty, so any string
  // (e.g. "abc") was accepted despite the +91XXXXXXXXXX-formatted
  // placeholder, with the backend's rejection as the only feedback.
  // Mirrors the backend's own E.164 check (whatsapp.schemas.ts's
  // `e164Phone`) rather than inventing a new rule.
  const E164_PHONE = /^\+[1-9]\d{6,14}$/;

  const submitShare = async () => {
    const trimmedPhone = sharePhone.trim();
    if (!trimmedPhone) return;
    if (!E164_PHONE.test(trimmedPhone)) {
      setSharePhoneError("Enter a full number with country code, e.g. +14155552671.");
      return;
    }
    setSharePhoneError(null);
    setWhatsappBusy("share");
    try {
      const res = await whatsappApi.shareProperty(property.id, trimmedPhone);
      showToast(res.message, "success");
      setShowShareForm(false);
      setSharePhone("");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not share this listing.", "error");
    } finally {
      setWhatsappBusy(null);
    }
  };

  const mapUrl = property.location
    ? `https://www.google.com/maps/search/?api=1&query=${property.location.latitude},${property.location.longitude}`
    : null;
  // No Google Maps JS SDK / API key exists in this frontend, so rather than
  // add a paid, key-gated dependency for one embed, this uses Google's
  // key-free "output=embed" iframe against the property's real coordinates.
  const mapEmbedUrl = property.location
    ? `https://maps.google.com/maps?q=${property.location.latitude},${property.location.longitude}&z=15&output=embed`
    : null;

  return (
    <div>
      <div className="details-layout">
        <div>
          <ImageGallery images={property.images} title={property.title} />

          <div className="page-header" style={{ marginTop: 20 }}>
            <div>
              {property.status !== "published" ? (
                <span className="pill-badge pill-badge--status">{property.status.replace("_", " ")}</span>
              ) : null}
              <h1 style={{ margin: "8px 0 4px" }}>{property.title}</h1>
              <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} />
                {[property.location?.locality, property.location?.city].filter(Boolean).join(", ") ||
                  "Location not set"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-primary)" }}>
                {formatCurrency(property.rentAmount)}
                <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--color-text-muted)" }}>/mo</span>
              </div>
              <button
                type="button"
                className={`icon-action${isFavorited ? " property-card-v2__fav--active" : ""}`}
                onClick={toggleFavorite}
                disabled={favoriteBusy}
                aria-pressed={isFavorited}
                style={{ marginTop: 8 }}
              >
                <Heart size={16} fill={isFavorited ? "currentColor" : "none"} />
                {isFavorited ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          <div className="detail-stats">
            <div className="detail-stat">
              <BedDouble size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.bedrooms}</div>
              <div className="detail-stat__label">Bedrooms</div>
            </div>
            <div className="detail-stat">
              <Bath size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.bathrooms}</div>
              <div className="detail-stat__label">Bathrooms</div>
            </div>
            <div className="detail-stat">
              <Car size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.parkingSpaces}</div>
              <div className="detail-stat__label">Parking</div>
            </div>
            <div className="detail-stat">
              <Ruler size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.areaSqft}</div>
              <div className="detail-stat__label">Sqft</div>
            </div>
            <div className="detail-stat">
              <Building2 size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.floorNumber ?? "-"}</div>
              <div className="detail-stat__label">Floor</div>
            </div>
            <div className="detail-stat">
              <Compass size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.facing ?? "-"}</div>
              <div className="detail-stat__label">Facing</div>
            </div>
            <div className="detail-stat">
              <Eye size={18} style={{ color: "var(--color-primary)" }} />
              <div className="detail-stat__value">{property.viewCount}</div>
              <div className="detail-stat__label">Views</div>
            </div>
          </div>

          <div className="form-section">
            <h2>Description</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{property.description}</p>
          </div>

          <div className="form-section">
            <h2>Details</h2>
            <div className="form-grid" style={{ rowGap: 8 }}>
              <div>
                <strong>Security deposit:</strong> {formatCurrency(property.securityDeposit)}
              </div>
              <div>
                <strong>Furnished:</strong> {property.furnishedStatus.replace("_", " ")}
              </div>
              <div>
                <strong>Available from:</strong> {property.availableFrom}
              </div>
              <div>
                <strong>Total floors:</strong> {property.totalFloors ?? "-"}
              </div>
              <div>
                <strong>Category:</strong> {property.category?.name ?? "-"}
              </div>
              <div>
                <strong>Property type:</strong> {property.propertyType}
              </div>
            </div>
          </div>

          {property.features.length > 0 && (
            <div className="form-section">
              <h2>Amenities</h2>
              <div className="amenity-grid">
                {property.features.map((f) => {
                  const Icon = AMENITY_ICONS[f] ?? Building2;
                  return (
                    <div key={f} className="amenity-item">
                      <span className="amenity-item__icon">
                        <Icon size={16} />
                      </span>
                      {f.replace(/_/g, " ")}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-section">
            <h2>Location</h2>
            <p>{property.location?.formattedAddress ?? property.location?.addressLine ?? "Not available"}</p>
            {mapEmbedUrl ? (
              <iframe className="map-embed" src={mapEmbedUrl} title="Property location map" loading="lazy" />
            ) : null}
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-v2 btn-v2--secondary btn-v2--sm" style={{ marginTop: 10 }}>
                Open in Google Maps
              </a>
            ) : null}
          </div>

          <RentAffordabilityCalculator
            rentAmount={property.rentAmount}
            monthlyIncome={monthlyIncome}
            onIncomeChange={setMonthlyIncome}
          />
        </div>

        <aside className="sidebar-card" id="contact">
          <div className="owner-card-v2">
            <div className="owner-card-v2__avatar">{(property.owner?.name ?? "?").charAt(0).toUpperCase()}</div>
            <div>
              <div className="owner-card-v2__name">{property.owner?.name ?? "Unknown owner"}</div>
              <div className="owner-card-v2__meta">Listed on RentIt</div>
            </div>
          </div>

          {!canManage ? (
            <button
              type="button"
              className="btn-v2 btn-v2--primary"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={startChat}
              disabled={messageBusy}
            >
              <MessageCircle size={16} /> {messageBusy ? "Starting chat..." : "Message owner"}
            </button>
          ) : null}

          {!canManage && isAuthenticated ? (
            <button
              type="button"
              className="btn-v2 btn-v2--secondary"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={contactOwnerViaWhatsApp}
              disabled={whatsappBusy !== null}
            >
              <PhoneCall size={16} /> {whatsappBusy === "contact" ? "Contacting..." : "Contact on WhatsApp"}
            </button>
          ) : null}

          {!canManage && isAuthenticated ? (
            <button
              type="button"
              className="btn-v2 btn-v2--secondary"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={scheduleVisit}
              disabled={whatsappBusy !== null}
            >
              <Calendar size={16} /> {whatsappBusy === "visit" ? "Requesting..." : "Schedule a visit"}
            </button>
          ) : null}

          {!canManage && isAuthenticated ? (
            <div style={{ marginBottom: 10 }}>
              {!showInquiryForm ? (
                <button
                  type="button"
                  className="btn-v2 btn-v2--secondary"
                  style={{ width: "100%" }}
                  onClick={() => setShowInquiryForm(true)}
                >
                  Send an inquiry
                </button>
              ) : (
                <div className="field">
                  <label htmlFor="inquiry-text">Your message</label>
                  <textarea
                    id="inquiry-text"
                    maxLength={300}
                    value={inquiryText}
                    onChange={(e) => setInquiryText(e.target.value)}
                    placeholder="Hi, is this property still available?"
                  />
                  <button
                    type="button"
                    className="btn-v2 btn-v2--primary"
                    style={{ width: "100%" }}
                    onClick={submitInquiry}
                    disabled={whatsappBusy !== null || !inquiryText.trim()}
                  >
                    {whatsappBusy === "inquiry" ? "Sending..." : "Send inquiry"}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div style={{ marginBottom: 10 }}>
            {!showShareForm ? (
              <button type="button" className="btn-v2 btn-v2--secondary" style={{ width: "100%" }} onClick={() => setShowShareForm(true)}>
                Share via WhatsApp
              </button>
            ) : (
              <div className="field">
                <label htmlFor="share-phone">Friend's WhatsApp number</label>
                <input
                  id="share-phone"
                  value={sharePhone}
                  onChange={(e) => {
                    setSharePhone(e.target.value);
                    setSharePhoneError(null);
                  }}
                  placeholder="+91XXXXXXXXXX"
                />
                {sharePhoneError ? <span className="field-error">{sharePhoneError}</span> : null}
                <button
                  type="button"
                  className="btn-v2 btn-v2--primary"
                  style={{ width: "100%" }}
                  onClick={submitShare}
                  disabled={whatsappBusy !== null || !sharePhone.trim()}
                >
                  {whatsappBusy === "share" ? "Sharing..." : "Share"}
                </button>
              </div>
            )}
          </div>

          {canManage ? (
            <>
              <Link to={`/properties/${property.id}/edit`} className="btn-v2 btn-v2--secondary" style={{ width: "100%", marginBottom: 10 }}>
                <Pencil size={16} /> Edit listing
              </Link>
              <button type="button" className="btn-v2 btn-v2--danger" style={{ width: "100%" }} onClick={handleDelete} disabled={deleting}>
                <Trash2 size={16} /> {deleting ? "Deleting..." : "Delete listing"}
              </button>
            </>
          ) : (
            <>
              {!showReportForm ? (
                <button type="button" className="btn-v2 btn-v2--secondary" style={{ width: "100%" }} onClick={() => setShowReportForm(true)}>
                  <Flag size={16} /> Report this listing
                </button>
              ) : reportStatus === "sent" ? (
                <div className="alert alert--success">Thanks -- your report has been submitted.</div>
              ) : (
                <div>
                  <div className="field">
                    <label htmlFor="report-reason">Reason</label>
                    <select id="report-reason" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                      {REPORT_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="report-details">Details (optional)</label>
                    <textarea
                      id="report-details"
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-v2 btn-v2--primary"
                    style={{ width: "100%" }}
                    onClick={submitReport}
                    disabled={reportStatus === "sending"}
                  >
                    {reportStatus === "sending" ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {recommendations.status === "loading" && (
        <div className="form-section">
          <h2>Similar properties</h2>
          <PropertyGridSkeleton count={4} />
        </div>
      )}

      {recommendations.status === "success" && recommendations.data.items.length > 0 && (
        <div className="form-section">
          <h2>Similar properties</h2>
          <div className="property-grid-v2">
            {recommendations.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </div>
      )}

      {/* Bug fix (QA report #11): a failed recommendations request used
          to have no error branch at all -- the whole section silently
          vanished with no indication anything went wrong. This is
          secondary content, so a small inline note (not a full
          ErrorState/retry) is enough. */}
      {recommendations.status === "error" && (
        <div className="form-section">
          <h2>Similar properties</h2>
          <p className="field-hint">Could not load similar properties.</p>
        </div>
      )}
    </div>
  );
}

/**
 * A real "rent affordability" calculator (the classic 30%-of-income rule),
 * built client-side purely from the property's real rent. The original
 * request asked for a "Mortgage Calculator" too, but this is a rental
 * marketplace -- there's no purchase price or loan data anywhere in the
 * system, so a mortgage calculator would have nothing real to compute from.
 * This rent calculator is the honest equivalent for a rental listing.
 */
function RentAffordabilityCalculator({
  rentAmount,
  monthlyIncome,
  onIncomeChange,
}: {
  rentAmount: number;
  monthlyIncome: string;
  onIncomeChange: (value: string) => void;
}) {
  const income = Number(monthlyIncome);
  const ratio = useMemo(() => (income > 0 ? (rentAmount / income) * 100 : null), [income, rentAmount]);

  return (
    <div className="form-section">
      <h2>
        <Calculator size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
        Rent affordability
      </h2>
      <div className="calculator-card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="monthly-income">Your monthly income</label>
          <input
            id="monthly-income"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="e.g. 80000"
            value={monthlyIncome}
            onChange={(e) => onIncomeChange(e.target.value)}
          />
        </div>
        <div className="calculator-card__row">
          <span>Monthly rent</span>
          <strong>{formatCurrency(rentAmount)}</strong>
        </div>
        {ratio !== null ? (
          <>
            <div className="calculator-card__row">
              <span>Rent as % of income</span>
              <strong>{ratio.toFixed(1)}%</strong>
            </div>
            <div className={`calculator-card__verdict calculator-card__verdict--${ratio <= 30 ? "good" : "tight"}`}>
              {ratio <= 30
                ? "Within the commonly recommended 30% of income guideline."
                : "Above the commonly recommended 30% of income guideline -- budget carefully."}
            </div>
          </>
        ) : (
          <p className="field-hint" style={{ marginTop: 8 }}>
            Enter your income to see how this rent fits your budget.
          </p>
        )}
      </div>
    </div>
  );
}
