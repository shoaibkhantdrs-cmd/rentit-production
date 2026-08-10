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
 * First-draft Cookie Policy, matching the Roadmap Item 1 pattern used by
 * PrivacyPolicyPage/TermsOfServicePage/ContactPage: legal facts not
 * established anywhere in this repository (legal entity name, jurisdiction,
 * exact cookie/local-storage names and TTLs) are left as clearly bracketed
 * placeholders rather than invented. What IS stated below is grounded in
 * this codebase's actual client-side storage usage at the time of writing:
 * a JWT access token + refresh token pair (auth persistence -- see
 * AuthContext / httpClient.ts), a theme preference (light/dark/auto --
 * ThemeContext), and recent searches (SearchPage, localStorage). This page
 * closes the last placeholder ("Cookie policy" -> href="/") left in
 * Footer.tsx's Legal column after Roadmap Item 1 shipped Privacy/Terms/
 * Contact; it is a first legal draft and must be reviewed and approved by
 * RentIt's business/legal owner before public launch, same as the other
 * three legal pages.
 */
export function CookiePolicyPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cookie Policy</h1>
          <p>Effective date: [EFFECTIVE DATE]</p>
        </div>
      </div>

      <div className="card" style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", lineHeight: 1.6 }}>
          <p style={bodyTextStyle}>
            This Cookie Policy explains how RentIt ("RentIt", "we", "us", "our") uses cookies and similar
            browser storage technologies on the RentIt platform (the "Service"), and the choices available
            to you. It should be read alongside our <Link to="/privacy-policy">Privacy Policy</Link>.
          </p>

          <section>
            <h2 style={sectionHeadingStyle}>1. What We Use, and Why</h2>
            <p style={bodyTextStyle}>
              RentIt does not currently use third-party advertising or tracking cookies. We use browser
              storage (cookies and/or local storage, depending on the item) only for functionality that is
              essential to operating the Service:
            </p>
            <ul style={listStyle}>
              <li>
                <strong>Sign-in / session</strong> — after you verify a one-time code, we store an access
                token and refresh token in your browser so you stay signed in between visits, instead of
                verifying a new code every time.
              </li>
              <li>
                <strong>Theme preference</strong> — whether you've chosen light mode, dark mode, or to follow
                your device's setting, so the site opens in the appearance you last chose.
              </li>
              <li>
                <strong>Recent searches</strong> — the search terms you've used recently on the Search page,
                stored only on your own device, so you can quickly revisit them.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>2. Third-Party Cookies</h2>
            <p style={bodyTextStyle}>
              Some pages load third-party scripts needed for a specific feature to work — for example, our
              payment gateways' hosted checkout (Razorpay and/or Stripe, where enabled) when you purchase a
              premium plan or listing boost, and OpenStreetMap-based maps when viewing a property's
              location. These providers may set their own cookies while their script is active on the page,
              governed by their own privacy/cookie policies, not this one.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>3. Your Choices</h2>
            <p style={bodyTextStyle}>
              Because the items above are essential to signing in and using core features, turning them off
              in your browser will affect functionality — for example, you'll be signed out, or your theme
              and recent searches won't be remembered. Most browsers let you view, delete, and block cookies
              and site data through their settings; consult your browser's help documentation for how.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>4. Contact Us</h2>
            <p style={bodyTextStyle}>
              If you have questions about this Cookie Policy, please reach out via our{" "}
              <Link to="/contact">Contact / Support page</Link>.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>5. Changes to This Policy</h2>
            <p style={bodyTextStyle}>
              We may update this Cookie Policy from time to time. Material changes will be reflected by
              updating the effective date at the top of this page.
            </p>
          </section>

          <p style={{ ...bodyTextStyle, fontSize: "0.85rem" }}>
            [LEGAL COMPANY NAME], [LEGAL ADDRESS]. Governing law: [JURISDICTION TO BE CONFIRMED].
          </p>
        </div>
      </div>
    </div>
  );
}
