import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, ListChecks, MessageCircle, TrendingUp } from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";
import { StatCard } from "@/components/ui/StatCard";

function MyPropertiesList() {
  const [page, setPage] = useState(1);
  const { status, data, error, reload } = useAsync(() => propertiesApi.mine(page, 20), [page]);

  // Phase 3 Part 3 (Owner Dashboard, must-have slice): real, owner-wide
  // totals from a dedicated endpoint, independent of the paginated listing
  // fetch above (these numbers cover every listing this owner has, not
  // just whichever page is currently showing). Replaces the old
  // page-local pageViews/pageFavorites reduce(), which only ever summed
  // the up-to-20 items on the current page and silently underreported for
  // any owner with more than one page of listings.
  const stats = useAsync(() => propertiesApi.myStats(), []);

  const mostViewed =
    status === "success" && data.items.length > 0
      ? data.items.reduce((a, b) => (b.viewCount > a.viewCount ? b : a))
      : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My properties</h1>
          <p>Everything you've listed on RentIt, including drafts.</p>
        </div>
        <Link to="/properties/new" className="btn-v2 btn-v2--primary">
          List a new property
        </Link>
      </div>

      {status === "success" && data.items.length > 0 ? (
        <div className="profile-stats-grid" style={{ marginBottom: "var(--space-6)" }}>
          <StatCard icon={<ListChecks size={18} />} label="Total listings" value={data.total} />
          <StatCard
            icon={<Eye size={18} />}
            label="Views"
            value={stats.status === "success" ? stats.data.totalViews : 0}
          />
          <StatCard
            icon={<Heart size={18} />}
            label="Favorites"
            value={stats.status === "success" ? stats.data.totalFavorites : 0}
          />
          <StatCard
            icon={<MessageCircle size={18} />}
            label="Enquiries"
            value={stats.status === "success" ? stats.data.totalEnquiries : 0}
          />
          {mostViewed ? (
            <StatCard
              icon={<TrendingUp size={18} />}
              label="Top performer"
              value={mostViewed.viewCount}
              hint={mostViewed.title}
            />
          ) : null}
        </div>
      ) : null}

      {status === "loading" && <PropertyGridSkeleton count={6} />}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          title="You haven't listed any properties yet"
          description="Create your first listing to start reaching renters."
          action={
            <Link to="/properties/new" className="btn-v2 btn-v2--primary">
              List a property
            </Link>
          }
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <>
          <div className="property-grid-v2">
            {data.items.map((item) => (
              <div key={item.id}>
                <PropertyCard property={item} />
                <div className="owner-listing-metrics">
                  <span>
                    <Eye size={13} /> {item.viewCount} view{item.viewCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    <Heart size={13} /> {item.favoriteCount} favorite{item.favoriteCount === 1 ? "" : "s"}
                  </span>
                </div>
                <Link
                  to={`/properties/${item.id}/boost`}
                  className="btn-v2 btn-v2--secondary btn-v2--sm"
                  style={{ marginTop: 8, width: "100%" }}
                >
                  Boost this listing
                </Link>
              </div>
            ))}
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export function MyPropertiesPage() {
  return (
    <RequireAuth message="Sign in to see the properties you've listed.">
      <MyPropertiesList />
    </RequireAuth>
  );
}
