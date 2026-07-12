import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthPanel } from "./AuthPanel";

/** Gates a page behind the shared AuthPanel instead of a dedicated route --
 * see AuthPanel's doc comment for why. */
export function RequireAuth({ children, message }: { children: ReactNode; message?: string }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <AuthPanel message={message} />;
  }
  return <>{children}</>;
}
