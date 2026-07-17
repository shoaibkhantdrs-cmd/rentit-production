import { useState } from "react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/admin/AdminWidgets";
import { ApiError } from "@/api/httpClient";
import { ReportStatus } from "@/api/types";

const PAGE_SIZE = 20;

function PropertyReportsTab() {
  const [status, setStatus] = useState<ReportStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { status: reqStatus, data, error, reload } = useAsync(
    () => adminApi.listPropertyReports(status || undefined, page, PAGE_SIZE),
    [status, page],
  );

  const resolve = async (reportId: string, newStatus: ReportStatus) => {
    setActionError(null);
    setBusy(true);
    try {
      await adminApi.updatePropertyReportStatus(reportId, newStatus);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-filter-bar">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as ReportStatus | ""); }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="action_taken">Action taken</option>
        </select>
      </div>

      {actionError ? <div className="alert alert--error">{actionError}</div> : null}

      {reqStatus === "loading" && <div className="skeleton" style={{ height: 240 }} />}
      {reqStatus === "error" && <ErrorState message={error} onRetry={reload} />}
      {reqStatus === "success" && data.items.length === 0 && <EmptyState title="No reported properties" />}

      {reqStatus === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Status</th>
                <th>Reported</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((report) => (
                <tr key={report.id}>
                  <td>{report.propertyId}</td>
                  <td>{report.reason.replace(/_/g, " ")}</td>
                  <td>{report.details ?? "—"}</td>
                  <td>
                    <StatusPill status={report.status} />
                  </td>
                  <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="admin-action-row">
                    {report.status === "pending" && (
                      <>
                        <button
                          className="btn btn--secondary btn--sm"
                          disabled={busy}
                          onClick={() => resolve(report.id, "action_taken")}
                        >
                          Resolve
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          disabled={busy}
                          onClick={() => resolve(report.id, "dismissed")}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
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

function UserReportsTab() {
  const [status, setStatus] = useState<ReportStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { status: reqStatus, data, error, reload } = useAsync(
    () => adminApi.listUserReports(status || undefined, page, PAGE_SIZE),
    [status, page],
  );

  const resolve = async (reportId: string, newStatus: ReportStatus) => {
    setActionError(null);
    setBusy(true);
    try {
      await adminApi.updateUserReportStatus(reportId, newStatus);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  // RC1 bug fix: previously resolved even on failure, so the call site
  // below marked the report "action_taken" even when the ban itself
  // failed. Now resolves `false` on failure so the caller can check.
  const ban = async (userId: string): Promise<boolean> => {
    const reason = window.prompt("Reason for banning this user:") ?? undefined;
    setActionError(null);
    setBusy(true);
    try {
      await adminApi.updateUserStatus(userId, "banned", reason);
      reload();
      return true;
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-filter-bar">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as ReportStatus | ""); }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="action_taken">Action taken</option>
        </select>
      </div>

      {actionError ? <div className="alert alert--error">{actionError}</div> : null}

      {reqStatus === "loading" && <div className="skeleton" style={{ height: 240 }} />}
      {reqStatus === "error" && <ErrorState message={error} onRetry={reload} />}
      {reqStatus === "success" && data.items.length === 0 && <EmptyState title="No reported users" />}

      {reqStatus === "success" && data.items.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reported user</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Status</th>
                <th>Reported</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((report) => (
                <tr key={report.id}>
                  <td>{report.reportedUserId}</td>
                  <td>{report.reason.replace(/_/g, " ")}</td>
                  <td>{report.details ?? "—"}</td>
                  <td>
                    <StatusPill status={report.status} />
                  </td>
                  <td>{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="admin-action-row">
                    {report.status === "pending" && (
                      <>
                        <button
                          className="btn btn--danger btn--sm"
                          disabled={busy}
                          onClick={() =>
                            ban(report.reportedUserId).then((ok) => {
                              if (ok) resolve(report.id, "action_taken");
                            })
                          }
                        >
                          Ban user
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          disabled={busy}
                          onClick={() => resolve(report.id, "dismissed")}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
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

export function ReportsPage() {
  const [tab, setTab] = useState<"properties" | "users">("properties");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Reported properties and reported users, in one queue.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab${tab === "properties" ? " admin-tab--active" : ""}`} onClick={() => setTab("properties")}>
          Reported properties
        </button>
        <button className={`admin-tab${tab === "users" ? " admin-tab--active" : ""}`} onClick={() => setTab("users")}>
          Reported users
        </button>
      </div>

      {tab === "properties" ? <PropertyReportsTab /> : <UserReportsTab />}
    </div>
  );
}
