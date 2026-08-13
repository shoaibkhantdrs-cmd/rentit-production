import type React from "react";
import { Newspaper } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

/**
 * COMPANY footer link #3. Previously pointed at href="/" (placeholder).
 * No press releases, media coverage, or press-kit assets exist anywhere in
 * this codebase, so this intentionally shows an honest empty state rather
 * than inventing publications, quotes, or awards.
 */
export function PressPage() {
  useDocumentTitle("Press & Media");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Press &amp; Media</h1>
          <p>News and media resources about RentIt.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <p style={{ ...bodyTextStyle, marginBottom: 0 }}>
            RentIt is a rental marketplace connecting property owners and renters directly across India --
            verified listings, direct owner contact, and no brokerage games.
          </p>
        </div>

        <div className="card" style={{ padding: "var(--space-6)" }}>
          <EmptyState
            icon={<Newspaper size={44} strokeWidth={1.5} />}
            title="No press coverage yet"
            description="We don't have press releases or media mentions to share at this time. For media inquiries, please reach out through our Contact & Support page."
            action={
              <a href="/contact" className="btn-v2 btn-v2--primary">
                Contact us
              </a>
            }
          />
        </div>
      </div>
    </div>
  );
}
