import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/admin/AdminWidgets";
import { ApiError } from "@/api/httpClient";
import { AdminPropertySort, BulkModerationAction, PropertyStatus } from "@/api/types";

const PAGE_SIZE = 20;

const TABS: Array<{ key: string; label: string; status?: PropertyStatus; isFeatured?: boolean }> = [
  { key: "all", label: "All" },
  { key: "pending_review", label: "Pending", status: "pending_review" },
  { key: "published", label: "Approved", status: "published" },
  { key: "rejected", label: "Rejected", status: "rejected" },
  { key: "inactive", label: "Hidden", status: "inactive" },
  { key: "featured", label: "Featured", isFeatured: true },
];

export function PropertiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialTab = TABS.find((t) => t.status === initialStatus)?.key ?? "all";

  const [tab, setTab] = useState(initialTab);
  const [sort, setSort] = useState<AdminPropertySort>("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  const { status, data, error, reload } = useAsync(
    () =>
      adminApi.searchProperties({
        status: activeTab.status,
        isFeatured: activeTab.isFeatured,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
    [tab, sort, page],
  );

  const changeTab = (key: string) => {
    setTab(key);
    setPage(1);
    setSelected(new Set());
    setSearchParams(key === "all" ? {} : { status: TABS.find((t) => t.key === key)?.status ?? "" });
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSingle = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (action: BulkModerationAction) => {
    if (selected.size === 0) return;
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("Reason for rejecting these listings:") ?? undefined;
      if (!reason) return;
    }
    if (action === "delete" && !window.confirm(`Delete ${selected.size} listing(s)? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      const result = await adminApi.bulkModerate([...selected], action, reason);
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        setActionError(`${failed.length} of ${result.results.length} failed: ${failed[0].error}`);
      }
      setSelected(new Set());
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Property moderation</h1>
          <p>Approve, reject, hide, and feature listings.</p>
        </div>
        <Link to="/admin/properties/moderation-history" className="btn btn--secondary btn--sm">
          Full moderation history
        </Link>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`admin-tab${tab === t.key ? " admin-tab--active" : ""}`}
            onClick={() => changeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-filter-bar">
        <select value={sort} onChange={(e) => setSort(e.target.value as AdminPropertySort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most_viewed">Most viewed</option>
          <option value="most_favorited">Most favorited</option>
        </select>

        {selected.size > 0 && (
          <div className="admin-bulk-bar">
            <span>{selected.size} selected</span>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("approve")}>
              Approve
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("reject")}>
              Reject
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("hide")}>
              Hide
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("unhide")}>
              Unhide
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("feature")}>
              Feature
            </button>
            <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => runBulk("unfeature")}>
              Unfeature
            </button>
            <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => runBulk("delete")}>
              Delete
            </button>
          </div>
        )}
      </div>

      {actionError ? <div className="alert alert--error">{actionError}</div> : null}

      {status === "loading" && <div className="skeleton" style={{ height: 320 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && data.items.length === 0 && <EmptyState title="No properties in this view" />}

      {status === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th />
                <th>Title</th>
                <th>Status</th>
                <th>Rent</th>
                <th>Views</th>
                <th>Favorites</th>
                <th>Featured</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((property) => (
                <tr key={property.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(property.id)}
                      onChange={() => toggleSelected(property.id)}
                    />
                  </td>
                  <td>{property.title}</td>
                  <td>
                    <StatusPill status={property.status} />
                  </td>
                  <td>₹{property.rentAmount.toLocaleString()}</td>
                  <td>{property.viewCount}</td>
                  <td>{property.favoriteCount}</td>
                  <td>{property.isFeatured ? "⭐" : "—"}</td>
                  <td className="admin-action-row">
                    {property.status === "pending_review" && (
                      <button
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => runSingle(() => adminApi.approveProperty(property.id))}
                      >
                        Approve
                      </button>
                    )}
                    {property.status !== "rejected" && (
                      <button
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt("Reason for rejecting this listing:");
                          if (!reason) return;
                          runSingle(() => adminApi.rejectProperty(property.id, reason));
                        }}
                      >
                        Reject
                      </button>
                    )}
                    {property.status === "inactive" ? (
                      <button
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => runSingle(() => adminApi.unhideProperty(property.id))}
                      >
                        Unhide
                      </button>
                    ) : (
                      <button
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => runSingle(() => adminApi.hideProperty(property.id))}
                      >
                        Hide
                      </button>
                    )}
                    {property.status === "published" &&
                      (property.isFeatured ? (
                        <button
                          className="btn btn--secondary btn--sm"
                          disabled={busy}
                          onClick={() => runSingle(() => adminApi.unfeatureProperty(property.id))}
                        >
                          Unfeature
                        </button>
                      ) : (
                        <button
                          className="btn btn--secondary btn--sm"
                          disabled={busy}
                          onClick={() => runSingle(() => adminApi.featureProperty(property.id))}
                        >
                          Feature
                        </button>
                      ))}
                    <Link to={`/admin/properties/${property.id}/history`} className="btn btn--ghost btn--sm">
                      History
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
