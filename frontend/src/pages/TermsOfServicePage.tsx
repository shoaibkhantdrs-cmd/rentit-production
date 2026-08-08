import type React from "react";
import { Link } from "react-router-dom";

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  margin: "0 0 8px",
};

const bodyTextStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
};

const listStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  margin: "0 0 8px",
  paddingLeft: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

/**
 * Roadmap Item 1: first-draft Terms of Service. Payments/premium-feature
 * language below is scoped strictly to what the codebase actually supports
 * (Razorpay/Stripe-processed listing boosts and premium plans). Governing
 * law and refund policy are left as bracketed placeholders since neither is
 * established anywhere in this repository. This page is a first legal
 * draft and must be reviewed and approved by RentIt's business/legal owner
 * before public launch.
 */
export function TermsOfServicePage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Terms of Service</h1>
          <p>Effective date: [EFFECTIVE DATE]</p>
        </div>
      </div>

      <div className="card" style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", lineHeight: 1.6 }}>
          <p style={bodyTextStyle}>
            These Terms of Service ("Terms") govern your use of RentIt (the "Service"), a marketplace that
            connects property owners and renters directly. By creating an account or using RentIt, you
            agree to these Terms.
          </p>

          <section>
            <h2 style={sectionHeadingStyle}>1. User Accounts</h2>
            <p style={bodyTextStyle}>
              You must provide accurate information when creating an account and keep your login
              credentials secure. You're responsible for all activity that happens under your account. We
              may ask you to verify your email or phone number by one-time code before certain actions are
              available.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>2. Property Listings</h2>
            <p style={bodyTextStyle}>
              Property owners are solely responsible for the accuracy of the listings they publish,
              including price, availability, photos, and property details. RentIt does not independently
              verify every listing and does not guarantee that any listing is accurate, available, or
              free of errors.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>3. User-Generated Content</h2>
            <p style={bodyTextStyle}>
              Content you submit — including listing descriptions, photos, and messages — remains yours,
              but by submitting it you grant RentIt a license to host, display, and transmit it as needed
              to operate the Service. You're responsible for making sure you have the right to share any
              content you upload.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>4. Prohibited Use</h2>
            <p style={bodyTextStyle}>You agree not to:</p>
            <ul style={listStyle}>
              <li>Post fraudulent, misleading, duplicate, or unauthorized property listings.</li>
              <li>Use the Service to harass, defraud, or deceive other users.</li>
              <li>Attempt to bypass identity verification or impersonate another person or property owner.</li>
              <li>Interfere with the security or normal operation of the Service.</li>
              <li>Use automated tools to scrape or access the Service outside of normal use.</li>
            </ul>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>5. Communication Between Users</h2>
            <p style={bodyTextStyle}>
              RentIt provides in-app chat so owners and renters can communicate directly. Messages you send
              must comply with these Terms. Please treat other users respectfully; abusive or harassing
              messages may be reported and can result in account action.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>6. Platform Role and Disclaimer</h2>
            <p style={bodyTextStyle}>
              RentIt is a platform that connects property owners and renters — we are not a broker, agent,
              landlord, or party to any rental agreement made between users. Any agreement to rent a
              property is solely between the owner and the renter. RentIt does not guarantee the outcome
              of any transaction, viewing, or rental arrangement made through the Service.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>7. Moderation and Reporting</h2>
            <p style={bodyTextStyle}>
              You can report a listing or a user directly from the Service if you believe it violates these
              Terms. Reports are reviewed by our team, who may take action including removing content or
              suspending accounts.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>8. Account Suspension and Termination</h2>
            <p style={bodyTextStyle}>
              We may suspend or terminate your account if you violate these Terms, misuse the Service, or
              engage in fraudulent or abusive behavior. You may stop using the Service, and request account
              deletion, at any time via our <Link to="/contact">Contact page</Link>.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>9. Intellectual Property</h2>
            <p style={bodyTextStyle}>
              The RentIt name, logo, and platform are owned by [LEGAL COMPANY NAME] and may not be used
              without permission. This does not affect ownership of the content you upload, as described in
              Section 3.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>10. Payments and Premium Features</h2>
            <p style={bodyTextStyle}>
              RentIt offers optional paid features, including listing boosts and premium plans. Payments
              for these features are processed by third-party payment gateways (Razorpay or Stripe, where
              enabled) — RentIt does not directly handle your card or bank details. Our refund policy is
              [REFUND POLICY TO BE CONFIRMED].
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>11. Limitation of Liability</h2>
            <p style={bodyTextStyle}>
              To the maximum extent permitted by law, RentIt is provided "as is" without warranties of any
              kind, and RentIt will not be liable for indirect, incidental, or consequential damages
              arising from your use of the Service. This section is a first-draft legal provision and has
              not yet been reviewed by legal counsel.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>12. Governing Law</h2>
            <p style={bodyTextStyle}>
              These Terms are governed by the laws of [JURISDICTION TO BE CONFIRMED], without regard to
              conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>13. Changes to These Terms</h2>
            <p style={bodyTextStyle}>
              We may update these Terms from time to time. Material changes will be reflected by updating
              the effective date at the top of this page.
            </p>
          </section>

          <p style={{ ...bodyTextStyle, fontSize: "0.85rem" }}>
            Questions about these Terms? Reach out via our <Link to="/contact">Contact / Support page</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
