import { ChangeEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Heart,
  ListChecks,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { verificationApi } from "@/api/verification";
import { paymentsApi } from "@/api/payments";
import { usersApi } from "@/api/users";
import { authApi } from "@/api/auth";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/api/httpClient";

/** Bare 10-digit numbers are assumed to be Indian and missing their "91"
 * prefix -- same assumption backend/.../PropertyDetailLoader.ts's own
 * normalizePhone() makes. Strips whatever's stored down to the 10-digit
 * national number for editing. */
function toNationalDigits(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/**
 * Contact Information: add/change a phone number and verify it via OTP.
 * Reuses the OTP infrastructure that already exists for login/email
 * verification (VerifyOtp.usecase.ts already handles purpose
 * "phone_verification") -- this section is the first frontend caller of
 * GET/PATCH /users/me and the new POST /users/me/phone/otp (resend without
 * changing the number). Country code is fixed at +91 per spec ("Accept
 * only Indian numbers"), using the same .input-group prefix pattern
 * already used for the ₹ rent input on the List Property wizard.
 */
function ContactInfoCard() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(!user?.phone);
  const [digits, setDigits] = useState(() => toNationalDigits(user?.phone ?? null));
  const [digitsError, setDigitsError] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  // Only ever set when the backend's DEV_OTP_MODE is on (see
  // usersApi.requestPhoneOtp/updateMe doc comments) -- real Twilio
  // delivery never populates this, so this card is a no-op in production.
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleDigitsChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDigits(e.target.value.replace(/\D/g, "").slice(0, 10));
    setDigitsError(null);
  };

  const resetOtpState = () => {
    setOtpSent(false);
    setPendingPhone(null);
    setCode("");
    setOtpError(null);
    setDevOtp(null);
  };

  /** Shared by every "a code was just issued" path -- if the backend
   * handed back a devOtp (DEV_OTP_MODE only), surface it in the UI and
   * pre-fill the verification field so dev/testing never has to go dig
   * through Render logs to find it. No-op (both args undefined) in a real
   * production response. */
  const applyIssuedOtp = (otp: string | undefined) => {
    setDevOtp(otp ?? null);
    setCode(otp ?? "");
  };

  const handleVerifyPhoneClick = async () => {
    if (!INDIAN_MOBILE_RE.test(digits)) {
      setDigitsError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    const fullPhone = `+91${digits}`;
    setSending(true);
    setOtpError(null);
    try {
      if (fullPhone !== user?.phone) {
        // Saving a new/changed number: UpdateMeUseCase checks for
        // duplicates, clears any prior verification, and auto-issues a
        // fresh phone_verification OTP -- see UpdateMe.usecase.ts.
        const result = await usersApi.updateMe({ phone: fullPhone });
        applyIssuedOtp(result.devOtp);
      } else {
        // Same number already on file, just unverified -- resend.
        const result = await usersApi.requestPhoneOtp();
        applyIssuedOtp(result.otp);
      }
      setPendingPhone(fullPhone);
      setOtpSent(true);
      showToast("Verification code sent to your phone.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send a verification code.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setSending(true);
    setOtpError(null);
    try {
      const result = await usersApi.requestPhoneOtp();
      applyIssuedOtp(result.otp);
      showToast("A new code has been sent.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not resend the code.", "error");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!pendingPhone || !code.trim()) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const result = await authApi.verifyOtp({
        identifier: pendingPhone,
        purpose: "phone_verification",
        code: code.trim(),
      });
      if (result.verified) {
        await refreshUser();
        showToast("Phone Verified ✅", "success");
        resetOtpState();
        setEditing(false);
      }
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : "Could not verify that code.");
    } finally {
      setVerifying(false);
    }
  };

  const startEditing = () => {
    setDigits(toNationalDigits(user?.phone ?? null));
    setDigitsError(null);
    resetOtpState();
    setEditing(true);
  };

  /** "Verify Phone" from the read-only view, for a number that's already
   * saved but unverified -- resends against `user.phone` directly rather
   * than going through the editable `digits` field (avoids reading
   * `digits` before a same-tick setState to it has actually applied). */
  const handleVerifySavedPhone = async () => {
    if (!user?.phone) return;
    setSending(true);
    try {
      const result = await usersApi.requestPhoneOtp();
      applyIssuedOtp(result.otp);
      setPendingPhone(user.phone);
      setOtpSent(true);
      showToast("Verification code sent to your phone.", "success");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not send a verification code.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Phone size={18} /> Contact Information
      </h3>

      {!editing && user?.phone ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>+91 {toNationalDigits(user.phone)}</span>
            <Badge variant={user.phoneVerified ? "success" : "warning"}>
              {user.phoneVerified ? "Verified" : "Pending"}
            </Badge>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {!user.phoneVerified ? (
              <button
                type="button"
                className="btn-v2 btn-v2--primary btn-v2--sm"
                onClick={handleVerifySavedPhone}
                disabled={sending}
              >
                {sending ? "Sending..." : "Verify Phone"}
              </button>
            ) : null}
            <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={startEditing}>
              Change number
            </button>
          </div>
        </div>
      ) : null}

      {editing && !otpSent ? (
        <div style={{ marginBottom: 14 }}>
          <div className="field">
            <label htmlFor="contact-phone">Mobile number</label>
            <div className="input-group">
              <span className="input-group__prefix">+91</span>
              <input
                id="contact-phone"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Example: 9876543210"
                value={digits}
                onChange={handleDigitsChange}
                maxLength={10}
              />
            </div>
            {digitsError ? <span className="field-error">{digitsError}</span> : null}
            <p className="field-hint">Indian mobile numbers only.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-v2 btn-v2--primary btn-v2--sm"
              onClick={handleVerifyPhoneClick}
              disabled={sending || digits.length !== 10}
            >
              {sending ? "Sending..." : "Verify Phone"}
            </button>
            {user?.phone ? (
              <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {otpSent ? (
        <div style={{ marginBottom: 14 }}>
          <p className="field-hint">
            Enter the code sent to <strong>{pendingPhone}</strong>.
          </p>
          {devOtp ? (
            // Only ever rendered when the backend's DEV_OTP_MODE is on --
            // see applyIssuedOtp. Surfaces the code Twilio would otherwise
            // have delivered by SMS so dev/testing doesn't need Render
            // logs; the field below is already pre-filled with it too.
            <div className="alert alert--info">
              Dev mode: verification code is <strong>{devOtp}</strong> (pre-filled below).
            </div>
          ) : null}
          {otpError ? <div className="alert alert--error">{otpError}</div> : null}
          <div className="field">
            <label htmlFor="contact-phone-otp">Verification code</label>
            <input
              id="contact-phone-otp"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-v2 btn-v2--primary btn-v2--sm"
              onClick={handleVerifyOtp}
              disabled={verifying || !code.trim()}
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>
            <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={handleResend} disabled={sending}>
              {sending ? "Resending..." : "Resend code"}
            </button>
            <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={resetOtpState}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!user?.phone && !editing ? <p className="field-hint">No phone number on file yet.</p> : null}
    </div>
  );
}

/**
 * A real dashboard, not a mockup: every number and status here comes from
 * an existing endpoint (My Properties, Favorites, Verification, Payment
 * History, and the chat unread count already used in the navbar). There is
 * no "Wallet" section -- this app has no internal wallet/credits concept,
 * only per-transaction Razorpay/Stripe payments, so "Payment history" is
 * the honest equivalent. There's no "current plan" badge either, because
 * the API has no endpoint for the signed-in user's active subscription
 * status -- Premium is a CTA linking to the real plans page instead of a
 * fabricated "You're on the Pro plan" claim.
 */
function Dashboard() {
  const { user, logoutAllDevices } = useAuth();
  const { unreadCount } = useChat();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const mine = useAsync(() => propertiesApi.mine(1, 4), []);
  const favorites = useAsync(() => propertiesApi.favorites(1, 4), []);
  const verification = useAsync(() => verificationApi.status(), []);
  const payments = useAsync(() => paymentsApi.history(1, 1), []);

  const [signOutAllOpen, setSignOutAllOpen] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const initials = user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      const revoked = await logoutAllDevices();
      showToast(`Signed out of ${revoked} session${revoked === 1 ? "" : "s"}.`, "success");
      navigate("/");
    } catch {
      showToast("Couldn't sign out of all devices. Try again.", "error");
    } finally {
      setSigningOutAll(false);
      setSignOutAllOpen(false);
    }
  };

  return (
    <div>
      <div className="profile-header">
        <div className="profile-header__avatar">{initials}</div>
        <div>
          <h1 style={{ margin: 0 }}>{user?.name ?? "Your account"}</h1>
          <p style={{ margin: "2px 0 0", color: "var(--color-text-muted)" }}>{user?.email}</p>
        </div>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <div className="profile-stat-card__value">{mine.status === "success" ? mine.data.total : "--"}</div>
          <div className="profile-stat-card__label">Your listings</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-card__value">{favorites.status === "success" ? favorites.data.total : "--"}</div>
          <div className="profile-stat-card__label">Favorites</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-card__value">{unreadCount}</div>
          <div className="profile-stat-card__label">Unread messages</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-card__value">{payments.status === "success" ? payments.data.total : "--"}</div>
          <div className="profile-stat-card__label">Payments on file</div>
        </div>
      </div>

      <div className="profile-section-grid">
        <ContactInfoCard />

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} /> Verification
          </h3>
          {verification.status === "success" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge variant={verification.data.emailVerified ? "success" : "neutral"}>Email</Badge>
              <Badge variant={verification.data.phoneVerified ? "success" : "neutral"}>Phone</Badge>
              <Badge variant={verification.data.identityVerified ? "success" : "neutral"}>Identity</Badge>
            </div>
          ) : (
            <p className="field-hint">Loading verification status...</p>
          )}
          <Link to="/verification" className="btn-v2 btn-v2--secondary btn-v2--sm">
            Manage verification <ChevronRight size={14} />
          </Link>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} /> Premium
          </h3>
          <p className="field-hint" style={{ marginBottom: 14 }}>
            Boost individual listings or subscribe to a plan for more visibility in search.
          </p>
          <Link to="/premium-plans" className="btn-v2 btn-v2--secondary btn-v2--sm">
            Explore premium plans <ChevronRight size={14} />
          </Link>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CreditCard size={18} /> Payments
          </h3>
          <p className="field-hint" style={{ marginBottom: 14 }}>
            {payments.status === "success"
              ? `${payments.data.total} payment${payments.data.total === 1 ? "" : "s"} on file.`
              : "View your boost and subscription payment history."}
          </p>
          <Link to="/payment-history" className="btn-v2 btn-v2--secondary btn-v2--sm">
            View payment history <ChevronRight size={14} />
          </Link>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={18} /> Notifications &amp; searches
          </h3>
          <p className="field-hint" style={{ marginBottom: 14 }}>
            Manage saved searches and how RentIt notifies you about new matches.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/saved-searches" className="btn-v2 btn-v2--secondary btn-v2--sm">
              Saved searches
            </Link>
            <Link to="/notification-preferences" className="btn-v2 btn-v2--secondary btn-v2--sm">
              Preferences
            </Link>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <LogOut size={18} /> Security
          </h3>
          <p className="field-hint" style={{ marginBottom: 14 }}>
            Signed in on a shared or lost device? Sign out everywhere at once.
          </p>
          <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={() => setSignOutAllOpen(true)}>
            Sign out of all devices
          </button>
        </div>
      </div>

      <div className="form-section">
        <div className="section-v2__header" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="section-v2__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ListChecks size={20} /> Your recent listings
            </h2>
          </div>
          <Link to="/my-properties" className="section-v2__link">
            View all &rarr;
          </Link>
        </div>
        {mine.status === "loading" && <PropertyGridSkeleton count={4} />}
        {mine.status === "success" && mine.data.items.length === 0 && (
          <p className="field-hint">
            You haven't listed anything yet. <Link to="/properties/new">List a property</Link> to get started.
          </p>
        )}
        {mine.status === "success" && mine.data.items.length > 0 && (
          <div className="property-grid-v2">
            {mine.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="section-v2__header" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="section-v2__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Heart size={20} /> Recent favorites
            </h2>
          </div>
          <Link to="/favorites" className="section-v2__link">
            View all &rarr;
          </Link>
        </div>
        {favorites.status === "loading" && <PropertyGridSkeleton count={4} />}
        {favorites.status === "success" && favorites.data.items.length === 0 && (
          <p className="field-hint">
            Nothing saved yet. <Link to="/search">Browse listings</Link> and tap the heart to save one.
          </p>
        )}
        {favorites.status === "success" && favorites.data.items.length > 0 && (
          <div className="property-grid-v2">
            {favorites.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link to="/search" className="btn-v2 btn-v2--secondary btn-v2--sm">
          <Search size={14} /> Search properties
        </Link>
        <Link to="/messages" className="btn-v2 btn-v2--secondary btn-v2--sm">
          <MessageCircle size={14} /> Messages
        </Link>
      </div>

      <Modal open={signOutAllOpen} onClose={() => setSignOutAllOpen(false)} title="Sign out of all devices?">
        <p className="field-hint" style={{ marginBottom: 16 }}>
          This ends every active session for your account, including this one -- you'll need to sign in again
          everywhere.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={() => setSignOutAllOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-v2 btn-v2--danger btn-v2--sm"
            onClick={handleSignOutAll}
            disabled={signingOutAll}
          >
            {signingOutAll ? "Signing out..." : "Sign out everywhere"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function ProfilePage() {
  return (
    <RequireAuth message="Sign in to view your dashboard.">
      <Dashboard />
    </RequireAuth>
  );
}
