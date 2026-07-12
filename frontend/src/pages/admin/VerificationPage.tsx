import { useState } from "react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import { StatusPill } from "@/components/admin/AdminWidgets";
import { ApiError } from "@/api/httpClient";
import { IdentityVerificationStatus } from "@/api/types";

const PAGE_SIZE = 20;

export function VerificationPage() {
  const [status, setStatus] = useState<IdentityVerificationStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { status: reqStatus, data, error, reload } = useAsync(
    () => adminApi.listVerifications(status || undefined, page, PAGE_SIZE),
    [status, page],
  );

  const approve = async (id: string) => {
    setActionError(null);
    setBusy(true);
    try {
      await adminApi.approveVerification(id);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this document:");
    if (!reason) return;
    setActionError(null);
    setBusy(true);
    try {
      await adminApi.rejectVerification(id, reason);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Owner verification</h1>
          <p>Review submitted identity documents.</p>
        </div>
      </div>

      <div className="admin-filter-bar">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as IdentityVerificationStatus | "");
          }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {actionError ? <div className="alert alert--error">{actionError}</div> : null}

      {reqStatus === "loading" && <div className="skeleton" style={{ height: 240 }} />}
      {reqStatus === "error" && <ErrorState message={error} onRetry={reload} />}
      {reqStatus === "success" && data.items.length === 0 && <EmptyState title="No verification requests" />}

      {reqStatus === "success" && data.items.length > 0 && (
        <>
          <div className="admin-verification-grid">
            {data.items.map((v) => (
              <div className="card admin-verification-card" key={v.id}>
                <a href={v.documentImageUrl} target="_blank" rel="noreferrer">
                  <img src={v.documentImageUrl} alt={`${v.documentType} submitted for review`} />
                </a>
                <div className="admin-verification-card__body">
                  <div>
                    <strong>{v.documentType.replace(/_/g, " ")}</strong>
                    <StatusPill status={v.status} />
                  </div>
                  <p className="field-hint">User: {v.userId}</p>
                  <p className="field-hint">Submitted {new Date(v.createdAt).toLocaleString()}</p>
                  {v.rejectionReason ? <p className="field-error">{v.rejectionReason}</p> : null}
                  {v.status === "pending" && (
                    <div className="admin-action-row">
                      <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => approve(v.id)}>
                        Approve
                      </button>
                      <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => reject(v.id)}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
