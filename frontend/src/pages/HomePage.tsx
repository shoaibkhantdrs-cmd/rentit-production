import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [city, setCity] = useState("");

  const { status, data, error, reload } = useAsync(
    () => propertiesApi.search({ sort: "newest", page: 1, pageSize: 8 }),
    [],
  );

  const recentlyViewed = useAsync(
    () => (isAuthenticated ? propertiesApi.recentlyViewed() : Promise.resolve({ items: [] })),
    [isAuthenticated],
  );

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    navigate(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div>
      <div className="form-section" style={{ textAlign: "center", padding: "40px 24px" }}>
        <h1 style={{ marginTop: 0 }}>Find your next place to rent</h1>
        <p className="field-hint">Search apartments, houses, PGs, and commercial spaces near you.</p>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, maxWidth: 480, margin: "20px auto 0" }}>
          <input
            aria-label="City"
            placeholder="Search by city, e.g. Pune"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--color-border)", borderRadius: 6, padding: "10px 12px" }}
          />
          <button type="submit" className="btn btn--primary">
            Search
          </button>
        </form>
      </div>

      {isAuthenticated && recentlyViewed.status === "success" && recentlyViewed.data.items.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="page-header">
            <div>
              <h2 style={{ margin: 0 }}>Recently viewed</h2>
            </div>
          </div>
          <div className="property-grid">
            {recentlyViewed.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Newest listings</h1>
          <p>Fresh properties added to RentIt.</p>
        </div>
      </div>

      {status === "loading" && <PropertyGridSkeleton count={8} />}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          title="No listings yet"
          description="Be the first to list a property on RentIt."
          action={
            <a href="/properties/new" className="btn btn--primary">
              List a property
            </a>
          }
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <div className="property-grid">
          {data.items.map((item) => (
            <PropertyCard key={item.id} property={item} />
          ))}
        </div>
      )}
    </div>
  );
}
