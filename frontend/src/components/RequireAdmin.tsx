import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthPanel } from "./AuthPanel";
import { EmptyState } from "./EmptyState";

const ADMIN_ROLES = ["admin", "super_admin"];

/** Gates the entire /admin/* section: signed out -> auth panel, signed in
 * without an admin role -> a plain "not authorized" state (never a blank
 * page or a silent redirect loop). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, authReady } = useAuth();

  // Bug fix (QA report #23): same fix as RequireAuth -- avoids a one-
  // frame flash of the signed-out fallback while dev auto-login is
  // still resolving. Always true synchronously in production.
  if (!authReady) return null;

  if (!isAuthenticated) {
    return <AuthPanel message="Sign in with an admin account to continue." />;
  }

  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.includes(role)) ?? false;
  if (!isAdmin) {
    return (
      <EmptyState
        icon="🔒"
        title="Admins only"
        description="Your account doesn't have access to the RentIt admin panel."
      />
    );
  }

  return <>{children}</>;
}
