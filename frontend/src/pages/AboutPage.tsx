import type React from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Search, ShieldCheck } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  margin: "0 0 8px",
};

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

const stepRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  alignItems: "flex-start",
  padding: "var(--space-4) 0",
  borderTop: "1px solid var(--color-border)",
};

const iconWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: "var(--radius-lg)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  flexShrink: 0,
  color: "var(--color-text)",
};

const HOW_IT_WORKS = [
  {
    icon: <Search size={18} />,
    title: "Search verified listings",
    body: "Browse apartments, houses, PGs, and commercial spaces with real photos, pricing, and location details -- no login required to look around.",
  },
  {
    icon: <MessageCircle size={18} />,
    title: "Message the owner directly",
    body: "Every listing connects you straight to the owner through in-app chat, no broker relaying messages back and forth or adding a fee on top.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Rent with confidence",
    body: "Owners go through an identity verification review before their first listing goes live, and email/phone verification underpins every account.",
  },
];

/**
 * COMPANY footer link #1. Previously the "About RentIt" footer link pointed
 * at href="/" (a placeholder, see Footer.tsx's prior doc comment) rather
 * than a real page -- fixed as part of the pre-launch footer-links audit.
 * Content below describes only real, shipped product behavior (search,
 * in-app chat, owner identity verification, direct no-broker contact) --
 * no invented company history, headcount, funding, or founding-story claims
 * that aren't established anywhere else in this codebase.
 */
export function AboutPage() {
  useDocumentTitle("About RentIt");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>About RentIt</h1>
          <p>India's premium rental marketplace -- verified listings, direct owner contact, no brokerage games.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--space-6)" }}>
          <h2 style={sectionHeadingStyle}>What RentIt is</h2>
          <p style={bodyTextStyle}>
            RentIt is an online rental marketplace that connects property owners and renters directly.
            Owners list apartments, houses, PG/hostel rooms, vacation stays, and commercial spaces; renters
            search, compare, and reach out -- all without a broker standing in the middle.
          </p>
          <p style={bodyTextStyle}>
            Renting a home in India traditionally means going through a broker: extra fees, listings that
            are outdated or already taken, and messages relayed secondhand instead of a direct conversation
            with the person who actually owns the property. RentIt exists to remove that friction --
            verified owners, real listings, and a direct line of communication from the first message to
            move-in.
          </p>
        </div>

        <div className="card" style={{ padding: "var(--space-6)" }}>
          <h2 style={sectionHeadingStyle}>How RentIt works</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.title} style={stepRowStyle}>
                <div style={iconWrapStyle}>{step.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
                  <p style={bodyTextStyle}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-6)" }}>
          <h2 style={sectionHeadingStyle}>Trust &amp; safety</h2>
          <p style={bodyTextStyle}>
            Every owner goes through an identity verification review before their first listing goes live,
            so renters know who they're actually dealing with. Accounts are backed by email and phone
            verification, listings go through moderation before they're published, and both owners and
            renters can report a listing or user directly from its page if something looks wrong -- our
            team reviews every report.
          </p>
          <p style={{ ...bodyTextStyle, marginBottom: 0 }}>
            Questions about how RentIt works? Visit our <Link to="/contact">Contact &amp; Support page</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
