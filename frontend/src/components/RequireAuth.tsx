import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthPanel } from "./AuthPanel";

/** Gates a page behind the shared AuthPanel instead of a dedicated route --
 * see AuthPanel's doc comment for why. */
export function RequireAuth({ children, message }: { children: ReactNode; message?: string }) {
  const { isAuthenticated, authReady } = useAuth();
  // Bug fix (QA report #23): dev-only auto-login resolves asynchronously
  // after mount, so this used to render AuthPanel for one frame before
  // it settled. authReady is always true synchronously in production --
  // this only changes dev behavior.
  if (!authReady) return null;
  if (!isAuthenticated) {
    return <AuthPanel message={message} />;
  }
  return <>{children}</>;
}
