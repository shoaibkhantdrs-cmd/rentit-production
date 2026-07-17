import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { useCompare } from "@/context/CompareContext";
import { PropertyDetail } from "@/api/types";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { formatCurrency } from "@/utils/format";

const ROWS: { label: string; render: (p: PropertyDetail) => string }[] = [
  { label: "Rent / month", render: (p) => formatCurrency(p.rentAmount) },
  { label: "Security deposit", render: (p) => formatCurrency(p.securityDeposit) },
  { label: "Area", render: (p) => `${p.areaSqft} sqft` },
  { label: "Bedrooms", render: (p) => String(p.bedrooms) },
  { label: "Bathrooms", render: (p) => String(p.bathrooms) },
  { label: "Parking", render: (p) => String(p.parkingSpaces) },
  { label: "Furnishing", render: (p) => p.furnishedStatus.replace("_", " ") },
  { label: "Category", render: (p) => p.category?.name ?? "--" },
  { label: "Location", render: (p) => [p.location?.locality, p.location?.city].filter(Boolean).join(", ") || "--" },
];

/** New page for the redesign's "Compare" feature -- fetches each queued
 * property's real detail via the existing `propertiesApi.getById` (no new
 * backend endpoint) and lays them out side by side. */
export function ComparePage() {
  const { ids, toggleCompare, clear } = useCompare();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (ids.length === 0) {
      setProperties([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setProperties(null);
    setError(null);
    // RC1 bug fix: this Promise.all had no .catch -- if any compared
    // property failed to load (e.g. deleted since being queued), the
    // rejection went unhandled and the page stayed stuck on its loading
    // skeleton forever with no way to recover.
    Promise.all(ids.map((id) => propertiesApi.getById(id)))
      .then((results) => {
        if (!cancelled) setProperties(results);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load these properties.");
      });
    return () => {
      cancelled = true;
    };
  }, [ids, reloadToken]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Compare properties</h1>
          <p>Side-by-side comparison of the listings you selected.</p>
        </div>
        {properties && properties.length > 0 ? (
          <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={clear}>
            Clear all
          </button>
        ) : null}
      </div>

      {error ? <ErrorState message={error} onRetry={() => setReloadToken((t) => t + 1)} /> : null}

      {!error && properties === null && <PropertyGridSkeleton count={3} />}

      {!error && properties !== null && properties.length === 0 && (
        <EmptyState
          title="Nothing to compare yet"
          description="Add two or more properties from Search or Home using the compare button on each card."
          action={
            <button type="button" className="btn-v2 btn-v2--primary" onClick={() => navigate("/search")}>
              Browse listings
            </button>
          }
        />
      )}

      {properties !== null && properties.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                {properties.map((p) => (
                  <th key={p.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>{p.title}</span>
                      <button
                        type="button"
                        className="nav-v2__icon-btn"
                        style={{ width: 26, height: 26 }}
                        onClick={() => toggleCompare(p.id)}
                        aria-label={`Remove ${p.title} from comparison`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ fontWeight: 700 }}>{row.label}</td>
                  {properties.map((p) => (
                    <td key={p.id}>{row.render(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
