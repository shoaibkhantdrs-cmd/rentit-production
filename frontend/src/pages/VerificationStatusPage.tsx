import { FormEvent, useState } from "react";
import { verificationApi } from "@/api/verification";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { IdentityDocumentType } from "@/api/types";

const DOCUMENT_TYPES: Array<{ value: IdentityDocumentType; label: string }> = [
  { value: "government_id", label: "Government ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving license" },
  { value: "other", label: "Other" },
];

function VerificationStatusContent() {
  const { status, data, error, reload } = useAsync(() => verificationApi.status(), []);
  const [documentType, setDocumentType] = useState<IdentityDocumentType>("government_id");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await verificationApi.submit(documentType, file);
      setFile(null);
      reload();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not submit your document.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") return <div className="skeleton" style={{ height: 200 }} />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  const latest = data.identityVerification;
  const canSubmit = !latest || latest.status === "rejected";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Verification status</h1>
          <p>Verify your email, phone, and identity to build trust with renters.</p>
        </div>
      </div>

      <div className="detail-stats" style={{ marginBottom: 24 }}>
        <div className="detail-stat">
          <div className="detail-stat__value">{data.emailVerified ? "✅" : "—"}</div>
          <div className="detail-stat__label">Email</div>
        </div>
        <div className="detail-stat">
          <div className="detail-stat__value">{data.phoneVerified ? "✅" : "—"}</div>
          <div className="detail-stat__label">Phone</div>
        </div>
        <div className="detail-stat">
          <div className="detail-stat__value">{data.identityVerified ? "✅" : "—"}</div>
          <div className="detail-stat__label">Identity</div>
        </div>
      </div>

      {latest && (
        <div className="alert alert--success" style={{ background: "var(--color-bg)" }}>
          Latest submission ({latest.documentType.replace(/_/g, " ")}): <strong>{latest.status}</strong>
          {latest.rejectionReason ? ` — ${latest.rejectionReason}` : ""}
        </div>
      )}

      {canSubmit && (
        <section className="form-section" style={{ maxWidth: 480 }}>
          <h2>Submit identity document</h2>
          {submitError ? <div className="alert alert--error">{submitError}</div> : null}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="doc-type">Document type</label>
              <select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as IdentityDocumentType)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="doc-file">Document photo</label>
              <input
                id="doc-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={submitting || !file}>
              {submitting ? "Submitting..." : "Submit for review"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

export function VerificationStatusPage() {
  return (
    <RequireAuth message="Sign in to verify your account.">
      <VerificationStatusContent />
    </RequireAuth>
  );
}
