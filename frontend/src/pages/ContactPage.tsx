import type React from "react";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

const rowStyle: React.CSSProperties = {
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

/**
 * Roadmap Item 1: first-draft Contact / Support page. No confirmed support
 * email or phone number exists anywhere in this repository (the only email
 * value present in code is `no-reply@rentit.example`, a transactional
 * "from" address default, not a real support inbox) -- so the direct-email
 * contact method was originally shown as a clearly bracketed placeholder
 * rather than invented. The in-app reporting mechanism referenced below
 * reflects real, existing product functionality (users can report
 * listings/users for review).
 *
 * SUPPORT_EMAIL below is a temporary real inbox, not a permanent one --
 * PrivacyPolicyPage.tsx tells users they can request account/data deletion
 * "by contacting us using the details on our Contact page", so this page
 * needs an actual working channel, not a placeholder, for that promise to
 * be true. Single named constant so swapping in RentIt's eventual official
 * support address is a one-line change here (nothing else on this page or
 * PrivacyPolicyPage.tsx hardcodes the address -- Privacy Policy links to
 * this page rather than duplicating the email).
 */
const SUPPORT_EMAIL = "shoaibdmx786@gmail.com";

export function ContactPage() {
  useDocumentTitle("Contact & Support");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contact &amp; Support</h1>
          <p>We're here to help with questions about listings, your account, or the RentIt platform.</p>
        </div>
      </div>

      <div className="card" style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
        <p style={bodyTextStyle}>
          Choose the option below that best fits what you need help with.
        </p>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={rowStyle}>
            <div style={iconWrapStyle}>
              <Mail size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Email support</div>
              <p style={bodyTextStyle}>
                For account, billing, general questions, or to request deletion of your account and
                data, email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={iconWrapStyle}>
              <MessageCircle size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Questions about a specific listing</div>
              <p style={bodyTextStyle}>
                The fastest way to reach a property owner is directly through the Contact Owner / in-app
                chat option on that listing's details page.
              </p>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={iconWrapStyle}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Report a listing or a user</div>
              <p style={bodyTextStyle}>
                If you believe a listing or user violates our{" "}
                <Link to="/terms">Terms of Service</Link>, use the report option available on that
                listing's or user's page so our team can review it.
              </p>
            </div>
          </div>
        </div>

        <p style={{ ...bodyTextStyle, fontSize: "0.85rem", marginTop: "var(--space-5)" }}>
          Registered business address: [LEGAL ADDRESS].
        </p>
      </div>
    </div>
  );
}
