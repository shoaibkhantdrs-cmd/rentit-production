import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Heart,
  ListChecks,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { verificationApi } from "@/api/verification";
import { paymentsApi } from "@/api/payments";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { RequireAuth } from "@/components/RequireAuth";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

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
