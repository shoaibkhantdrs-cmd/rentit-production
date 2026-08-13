import type React from "react";
import { NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

/**
 * COMPANY footer link #4. Previously pointed at href="/" (placeholder).
 * No blog/CMS/articles system exists anywhere in this codebase (backend or
 * frontend) -- confirmed by search before writing this page. Rather than
 * invent fake posts, this ships as a real landing page with an honest
 * "coming soon" empty state; wiring it up to real content later only
 * requires replacing the EmptyState block below.
 */
export function BlogPage() {
  useDocumentTitle("Blog");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>RentIt Blog</h1>
          <p>Guides and updates on renting, listing, and everything in between.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <EmptyState
            icon={<NotebookPen size={44} strokeWidth={1.5} />}
            title="Articles coming soon"
            description="We're working on guides for renters and property owners -- how to search smarter, what to check before signing a lease, tips for listing your first property, and more. Check back soon."
          />
        </div>

        <p style={{ ...bodyTextStyle, textAlign: "center", marginBottom: 0 }}>
          Have a topic you'd like us to cover? <a href="/contact">Let us know</a>.
        </p>
      </div>
    </div>
  );
}
