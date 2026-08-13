import type React from "react";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

/**
 * COMPANY footer link #2. Previously pointed at href="/" (placeholder).
 * No job requisition / ATS system exists anywhere in this codebase, so
 * rather than invent fake openings this shows an honest "no current
 * openings" empty state. The "reach out" mechanism reuses the same real
 * support inbox already wired up on ContactPage.tsx -- no new backend
 * or third-party ATS integration introduced.
 */
export function CareersPage() {
  useDocumentTitle("Careers at RentIt");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Careers at RentIt</h1>
          <p>Help us build a simpler, more direct way to rent a home.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <p style={{ ...bodyTextStyle, marginBottom: 0 }}>
            RentIt is a rental marketplace connecting property owners and renters directly -- verified
            listings, direct owner contact, and no brokerage games. We're building that experience for
            renters and owners across India.
          </p>
        </div>

        <div className="card" style={{ padding: "var(--space-6)" }}>
          <EmptyState
            icon={<Briefcase size={44} strokeWidth={1.5} />}
            title="No current openings"
            description="We don't have any open positions right now, but we're always happy to hear from people who want to help build RentIt. Reach out through our Contact & Support page and tell us what you'd like to work on."
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
