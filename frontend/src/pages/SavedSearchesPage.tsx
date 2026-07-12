import { useState } from "react";
import { Link } from "react-router-dom";
import { savedSearchesApi } from "@/api/savedSearches";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { describeSavedSearchFilters } from "@/utils/describeSavedSearch";
import { SavedSearch } from "@/api/types";
import { buildSearchLink } from "@/utils/savedSearchLink";

function SavedSearchRow({
  savedSearch,
  onChanged,
}: {
  savedSearch: SavedSearch;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const toggleNotify = async () => {
    setBusy(true);
    setRowError(null);
    try {
      await savedSearchesApi.update(savedSearch.id, { notifyOnMatch: !savedSearch.notifyOnMatch });
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Could not update this saved search.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the saved search "${savedSearch.name}"?`)) return;
    setBusy(true);
    setRowError(null);
    try {
      await savedSearchesApi.remove(savedSearch.id);
      onChanged();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Could not delete this saved search.");
      setBusy(false);
    }
  };

  return (
    <div className="card saved-search-row">
      <div>
        <h3 style={{ margin: "0 0 4px" }}>
          <Link to={buildSearchLink(savedSearch.filters)}>{savedSearch.name}</Link>
        </h3>
        <p className="field-hint" style={{ margin: 0 }}>
          {describeSavedSearchFilters(savedSearch.filters)}
        </p>
        {rowError ? <div className="alert alert--error" style={{ marginTop: 8 }}>{rowError}</div> : null}
      </div>
      <div className="saved-search-row__actions">
        <label className="saved-search-row__toggle">
          <input type="checkbox" checked={savedSearch.notifyOnMatch} disabled={busy} onChange={toggleNotify} />
          Notify me
        </label>
        <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}

function SavedSearchesList() {
  const { status, data, error, reload } = useAsync(() => savedSearchesApi.list(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Saved searches</h1>
          <p>We'll notify you when a new listing matches one of these.</p>
        </div>
        <Link to="/search" className="btn btn--primary">
          Start a new search
        </Link>
      </div>

      {status === "loading" && (
        <div className="saved-search-list" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card saved-search-row">
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton--title" style={{ width: "40%" }} />
                <div className="skeleton skeleton--text" style={{ width: "70%" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          icon="🔔"
          title="No saved searches yet"
          description='Run a search, then click "Save this search" to get notified about new matches.'
          action={
            <Link to="/search" className="btn btn--primary">
              Go to search
            </Link>
          }
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <div className="saved-search-list">
          {data.items.map((savedSearch) => (
            <SavedSearchRow key={savedSearch.id} savedSearch={savedSearch} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SavedSearchesPage() {
  return (
    <RequireAuth message="Sign in to manage your saved searches.">
      <SavedSearchesList />
    </RequireAuth>
  );
}
