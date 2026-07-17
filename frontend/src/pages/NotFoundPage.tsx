import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export function NotFoundPage() {
  return (
    <div style={{ padding: "var(--space-8) 0" }}>
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link to="/" className="btn-v2 btn-v2--primary">
            <Home size={16} /> Back to home
          </Link>
        }
      />
    </div>
  );
}
