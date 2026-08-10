import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/httpClient";

type Step = "identify" | "otp" | "register" | "forgot" | "reset";

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
 *
 * "forgot"/"reset" steps: the real sign-in path here is OTP-only (above),
 * never a password -- but the backend's forgot/reset-password endpoints
 * exist and are actually triggered by the admin panel's "Reset password"
 * action (UserDetailPage.tsx), which emails the user a password_reset
 * code. Before these steps existed, that code had nowhere to be entered
 * anywhere in the app. Completing the reset doesn't change how this user
 * signs in afterward (still OTP, via "identify"/"otp" above) -- what it
 * actually accomplishes is finishing the account-recovery/security action
 * the admin started (resetting the password also revokes every existing
 * session server-side), so the user isn't left with an unresolved "someone
 * reset your password" email and no way to act on it.
 */
export function AuthPanel({ message }: { message?: string }) {
  const { requestLoginOtp, verifyLoginOtp, register } = useAuth();
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleIdentify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestLoginOtp(identifier.trim());
      setStep("otp");
    } catch (err) {
            setError(
                      err instanceof ApiError
                        ? err.requestId
                          ? `${err.message} (Ref: ${err.requestId})`
                          : err.message
                        : "Could not start login. Please try again.",
                    );
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
                ? `No account found or the code was wrong. New here? Use "Create an account" below.${
                                err.requestId ? ` (Ref: ${err.requestId})` : ""
                }`
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
            setError(
                      err instanceof ApiError
                        ? err.requestId
                          ? `${err.message} (Ref: ${err.requestId})`
                          : err.message
                        : "Could not create your account. Please try again.",
                    );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: identifier.trim() });
      setInfo(null);
      setStep("reset");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.requestId
            ? `${err.message} (Ref: ${err.requestId})`
            : err.message
          : "Could not start password reset. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ email: identifier.trim(), code: resetCode.trim(), newPassword });
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
      setInfo("Password reset. Sign in with the code we'll send to your email, as usual.");
      setStep("identify");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.requestId
            ? `${err.message} (Ref: ${err.requestId})`
            : err.message
          : "Could not reset your password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-panel">
      <h2>Sign in to continue</h2>
      {message ? <p className="field-hint">{message}</p> : null}
      {info ? <div className="alert alert--success">{info}</div> : null}
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
          <button type="submit" className="btn-v2 btn-v2--primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Sending code..." : "Send login code"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("register")}>
              New here? Create an account
            </button>
          </p>
          <p style={{ textAlign: "center", marginTop: 6 }}>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setError(null);
                setInfo(null);
                setStep("forgot");
              }}
            >
              Had a password reset from support? Set a new password
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
          <button type="submit" className="btn-v2 btn-v2--primary" style={{ width: "100%" }} disabled={submitting}>
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
          <button type="submit" className="btn-v2 btn-v2--primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("identify")}>
              Already have an account? Sign in
            </button>
          </p>
        </form>
      )}

      {step === "forgot" && (
        <form onSubmit={handleForgotPassword}>
          <p className="field-hint">
            If support reset your password, enter your account email and we'll send a code to set a new one.
          </p>
          <div className="field">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn-v2 btn-v2--primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Sending code..." : "Send reset code"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("identify")}>
              Back to sign in
            </button>
          </p>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetPassword}>
          <p className="field-hint">
            Enter the code sent to <strong>{identifier}</strong> and choose a new password.
          </p>
          <div className="field">
            <label htmlFor="reset-code">Reset code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              required
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="123456"
            />
          </div>
          <div className="field">
            <label htmlFor="reset-new-password">New password</label>
            <input
              id="reset-new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reset-confirm-password">Confirm new password</label>
            <input
              id="reset-confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-v2 btn-v2--primary" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Resetting..." : "Reset password"}
          </button>
          <p style={{ textAlign: "center", marginTop: 14 }}>
            <button type="button" className="link-button" onClick={() => setStep("forgot")}>
              Didn't get a code? Send again
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
