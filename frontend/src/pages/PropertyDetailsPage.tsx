import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { chatApi } from "@/api/chat";
import { whatsappApi } from "@/api/whatsapp";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { ImageGallery } from "@/components/ImageGallery";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyDetailSkeleton, PropertyGridSkeleton } from "@/components/Skeletons";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "duplicate_listing", label: "Duplicate listing" },
  { value: "offensive_content", label: "Offensive content" },
  { value: "already_rented", label: "Already rented" },
  { value: "other", label: "Other" },
];

function formatRent(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

export function PropertyDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { status, data: property, error, reload } = useAsync(() => propertiesApi.getById(id), [id]);
  const recommendations = useAsync(() => propertiesApi.recommendationsForProperty(id), [id]);

  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [deleting, setDeleting] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<string | null>(null);
  const [whatsappBusy, setWhatsappBusy] = useState<"contact" | "inquiry" | "share" | null>(null);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [showShareForm, setShowShareForm] = useState(false);
  const [sharePhone, setSharePhone] = useState("");

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
      setActionError("Sign in to save favorites.");
      return;
    }
    setFavoriteBusy(true);
    setActionError(null);
    try {
      if (isFavorited) {
        await propertiesApi.unfavorite(property.id);
        setFavoriteOverride(false);
      } else {
        await propertiesApi.favorite(property.id);
        setFavoriteOverride(true);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update favorites.");
    } finally {
      setFavoriteBusy(false);
    }
  };

  const submitReport = async () => {
    setReportStatus("sending");
    setActionError(null);
    try {
      await propertiesApi.report(property.id, reportReason, reportDetails.trim() || undefined);
      setReportStatus("sent");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not submit report.");
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
      setActionError(err instanceof ApiError ? err.message : "Could not delete this listing.");
      setDeleting(false);
    }
  };

  const startChat = async () => {
    if (!isAuthenticated) {
      setActionError("Sign in to message the owner.");
      return;
    }
    if (!property.owner) return;
    setMessageBusy(true);
    setActionError(null);
    try {
      const conversation = await chatApi.startConversation(property.owner.id, property.id);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not start a conversation.");
    } finally {
      setMessageBusy(false);
    }
  };

  const contactOwnerViaWhatsApp = async () => {
    setWhatsappBusy("contact");
    setWhatsappStatus(null);
    try {
      const res = await whatsappApi.contactOwner(property.id);
      setWhatsappStatus(res.message);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not reach the owner on WhatsApp.");
    } finally {
      setWhatsappBusy(null);
    }
  };

  const submitInquiry = async () => {
    if (!inquiryText.trim()) return;
    setWhatsappBusy("inquiry");
    setWhatsappStatus(null);
    try {
      const res = await whatsappApi.sendInquiry(property.id, inquiryText.trim());
      setWhatsappStatus(res.message);
      setShowInquiryForm(false);
      setInquiryText("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not send that inquiry.");
    } finally {
      setWhatsappBusy(null);
    }
  };

  const submitShare = async () => {
    if (!sharePhone.trim()) return;
    setWhatsappBusy("share");
    setWhatsappStatus(null);
    try {
      const res = await whatsappApi.shareProperty(property.id, sharePhone.trim());
      setWhatsappStatus(res.message);
      setShowShareForm(false);
      setSharePhone("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not share this listing.");
    } finally {
      setWhatsappBusy(null);
    }
  };

  const mapUrl = property.location
    ? `https://www.google.com/maps/search/?api=1&query=${property.location.latitude},${property.location.longitude}`
    : null;

  return (
    <div>
      <div className="details-layout">
        <div>
          <ImageGallery images={property.images} title={property.title} />

          <div className="page-header" style={{ marginTop: 20 }}>
            <div>
              <span className={`badge badge--${property.status}`}>{property.status.replace("_", " ")}</span>
              <h1 style={{ margin: "8px 0 4px" }}>{property.title}</h1>
              <p>
                {[property.location?.locality, property.location?.city].filter(Boolean).join(", ") ||
                  "Location not set"}
              </p>
            </div>
            <div className="property-card__rent" style={{ fontSize: "1.4rem" }}>
              ₹{formatRent(property.rentAmount)}/mo
            </div>
          </div>

          {actionError ? <div className="alert alert--error">{actionError}</div> : null}

          <div className="detail-stats">
            <div className="detail-stat">
              <div className="detail-stat__value">{property.bedrooms}</div>
              <div className="detail-stat__label">Bedrooms</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat__value">{property.bathrooms}</div>
              <div className="detail-stat__label">Bathrooms</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat__value">{property.parkingSpaces}</div>
              <div className="detail-stat__label">Parking</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat__value">{property.areaSqft}</div>
              <div className="detail-stat__label">Sqft</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat__value">{property.floorNumber ?? "-"}</div>
              <div className="detail-stat__label">Floor</div>
            </div>
            <div className="detail-stat">
              <div className="detail-stat__value">{property.facing ?? "-"}</div>
              <div className="detail-stat__label">Facing</div>
            </div>
            <div className="detail-stat">
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
                <strong>Security deposit:</strong> ₹{formatRent(property.securityDeposit)}
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
              <h2>Features</h2>
              <div className="feature-list">
                {property.features.map((f) => (
                  <span key={f} className="feature-chip">
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-section">
            <h2>Location</h2>
            <p>{property.location?.formattedAddress ?? property.location?.addressLine ?? "Not available"}</p>
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="btn btn--secondary btn--sm">
                View on map
              </a>
            ) : null}
          </div>
        </div>

        <aside className="sidebar-card">
          <h3 style={{ marginTop: 0 }}>Listed by</h3>
          <p>{property.owner?.name ?? "Unknown"}</p>

          <button
            type="button"
            className="btn btn--block"
            style={{ marginBottom: 10 }}
            onClick={toggleFavorite}
            disabled={favoriteBusy}
          >
            {isFavorited ? "★ Saved to favorites" : "☆ Save to favorites"}
          </button>

          {!canManage ? (
            <button
              type="button"
              className="btn btn--secondary btn--block"
              style={{ marginBottom: 10 }}
              onClick={startChat}
              disabled={messageBusy}
            >
              {messageBusy ? "Starting chat..." : "Message owner"}
            </button>
          ) : null}

          {!canManage && isAuthenticated ? (
            <button
              type="button"
              className="btn btn--secondary btn--block"
              style={{ marginBottom: 10 }}
              onClick={contactOwnerViaWhatsApp}
              disabled={whatsappBusy !== null}
            >
              {whatsappBusy === "contact" ? "Contacting..." : "Contact owner on WhatsApp"}
            </button>
          ) : null}

          {!canManage && isAuthenticated ? (
            <div style={{ marginBottom: 10 }}>
              {!showInquiryForm ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  onClick={() => setShowInquiryForm(true)}
                >
                  Send an inquiry via WhatsApp
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
                    className="btn btn--primary btn--block"
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
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowShareForm(true)}>
                Share via WhatsApp
              </button>
            ) : (
              <div className="field">
                <label htmlFor="share-phone">Friend's WhatsApp number</label>
                <input
                  id="share-phone"
                  value={sharePhone}
                  onChange={(e) => setSharePhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                />
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={submitShare}
                  disabled={whatsappBusy !== null || !sharePhone.trim()}
                >
                  {whatsappBusy === "share" ? "Sharing..." : "Share"}
                </button>
              </div>
            )}
          </div>

          {whatsappStatus ? <div className="alert alert--success">{whatsappStatus}</div> : null}

          {canManage ? (
            <>
              <Link to={`/properties/${property.id}/edit`} className="btn btn--secondary btn--block" style={{ marginBottom: 10 }}>
                Edit listing
              </Link>
              <button type="button" className="btn btn--danger btn--block" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete listing"}
              </button>
            </>
          ) : (
            <>
              {!showReportForm ? (
                <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowReportForm(true)}>
                  Report this listing
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
                    className="btn btn--primary btn--block"
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
          <div className="property-grid">
            {recommendations.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
