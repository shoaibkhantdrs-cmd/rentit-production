import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/httpClient";

type Step = "identify" | "otp" | "register";

/**
 * Small, reusable login/register widget. Phase 3's page list (PART 7)
 * doesn't include dedicated Login/Register pages, but Add Property, Edit
 * Property, My Properties, and Favorites all require an authenticated
 * user, so this component is shown inline wherever a protected page needs
 * one. Backend accounts are OTP-first (see Phase 2): existing users get a
 * code, brand-new identifiers need to register first.
 *
 * Note for local development: this project uses the Phase 2
 * ConsoleNotificationSender, so OTP codes are printed to the *backend*
 * server console/logs rather than actually emailed -- there is no real
 * email/SMS provider wired up. See docs/phase-3.md.
 */
export function AuthPanel({ message }: { message?: string }) {
  const { requestLoginOtp, verifyLoginOtp, register } = useAuth();
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleIdentify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestLoginOtp(identifier.trim());
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start login. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await verifyLoginOtp(identifier.trim(), code.trim());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? "No account found or the code was wrong. New here? Use \"Create an account\" below."
          : "Could not verify the code. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: identifier.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-panel">
      <h2>Sign in to continue</h2>
      {message ? <p className="field-hint">{message}</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {step === "identify" && (
        <form onSubmit={handleIdentify}>
          <div className="field">
            <label htmlFor="auth-identifier">Email or phone</label>
            <input
              id="auth-identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Sending code..." : "Send login code"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("register")}>
              New here? Create an account
            </button>
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerify}>
          <p className="field-hint">
            Enter the code sent to <strong>{identifier}</strong>.
          </p>
          <div className="field">
            <label htmlFor="auth-code">Verification code</label>
            <input
              id="auth-code"
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Verifying..." : "Verify and sign in"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("identify")}>
              Use a different email
            </button>
          </p>
        </form>
      )}

      {step === "register" && (
        <form onSubmit={handleRegister}>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input id="reg-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("identify")}>
              Already have an account? Sign in
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
