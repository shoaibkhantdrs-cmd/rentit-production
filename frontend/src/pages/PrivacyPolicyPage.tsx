import type React from "react";
import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
 * Roadmap Item 1: first-draft Privacy Policy. Company-identifying facts that
 * are not established anywhere in this repository (legal entity name,
 * registered address, phone number, jurisdiction, confirmed support email,
 * data-retention periods) are left as clearly bracketed placeholders rather
 * than invented. Third-party services named below are limited to ones with
 * real code paths in this codebase (Cloudinary, Twilio, Brevo, Firebase
 * Cloud Messaging, WhatsApp Business API, Razorpay/Stripe, OpenStreetMap
 * Nominatim). This page is a first legal draft and must be reviewed and
 * approved by RentIt's business/legal owner before public launch.
 */
export function PrivacyPolicyPage() {
  useDocumentTitle("Privacy Policy");
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Privacy Policy</h1>
          <p>Effective date: [EFFECTIVE DATE]</p>
        </div>
      </div>

      <div className="card" style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", lineHeight: 1.6 }}>
          <p style={bodyTextStyle}>
            This Privacy Policy explains what information RentIt ("RentIt", "we", "us", "our") collects
            when you use the RentIt platform (the "Service"), how we use it, and the choices available to
            you. RentIt is a marketplace that connects property owners and renters directly, without a
            broker in the middle.
          </p>

          <section>
            <h2 style={sectionHeadingStyle}>1. Information We Collect</h2>
            <p style={bodyTextStyle}>We collect the following categories of information:</p>
            <ul style={listStyle}>
              <li>
                <strong>Account information</strong> — your name, email address, and password (stored as a
                secure hash, never in plain text) when you register.
              </li>
              <li>
                <strong>Email and phone verification</strong> — when you verify your email or phone number,
                we send a one-time verification code (by email, or by SMS for phone verification) and
                record whether verification succeeded.
              </li>
              <li>
                <strong>Phone number</strong> — if you choose to add a phone number to your profile, for
                verification and so renters/owners can reach you where you've enabled that.
              </li>
              <li>
                <strong>Property and listing information</strong> — details you submit when listing a
                property, including property type, price, description, amenities, and address/location.
              </li>
              <li>
                <strong>Photos and media</strong> — images you upload for a property listing, stored via
                our image-hosting provider, Cloudinary.
              </li>
              <li>
                <strong>Location and address information</strong> — the address or location you provide for
                a listing, which we convert to map coordinates using OpenStreetMap's Nominatim geocoding
                service.
              </li>
              <li>
                <strong>Messages</strong> — content you send through RentIt's in-app chat between owners and
                renters, so the conversation can be delivered and displayed to both participants.
              </li>
              <li>
                <strong>Identity verification information</strong> — if you choose to verify your identity
                as a property owner, the document you submit (such as a government ID, passport, or
                driving license) and its review status.
              </li>
              <li>
                <strong>Payment information</strong> — if you purchase a premium plan or listing boost,
                payment is handled by a third-party payment gateway (Razorpay or Stripe, where enabled).
                RentIt does not collect or store your full card or bank details; the gateway processes
                payment and returns a transaction/order reference to us.
              </li>
              <li>
                <strong>Analytics, log, and security information</strong> — standard technical data such as
                IP address, device/browser information, and request timestamps, used for security, abuse
                prevention, and rate limiting.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>2. How We Use Your Information</h2>
            <ul style={listStyle}>
              <li>To create and secure your account, and to verify your email, phone, and (where submitted) identity.</li>
              <li>To operate the marketplace — publishing listings, enabling search, and connecting owners with renters.</li>
              <li>To deliver messages you send through in-app chat.</li>
              <li>To process payments for optional premium features, via our third-party payment gateways.</li>
              <li>To send account-related notifications (for example, verification codes, saved-search alerts, or chat notifications) by email, SMS, push notification, or WhatsApp, where you've enabled that channel.</li>
              <li>To detect, prevent, and investigate fraud, abuse, and violations of our Terms of Service.</li>
              <li>To maintain the security and reliability of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>3. Third-Party Services</h2>
            <p style={bodyTextStyle}>
              We use the following third-party services to operate RentIt. Each provider only receives the
              information necessary to perform its function on our behalf:
            </p>
            <ul style={listStyle}>
              <li><strong>Cloudinary</strong> — stores and serves property photos and uploaded documents.</li>
              <li><strong>Twilio</strong> — sends SMS messages for phone verification.</li>
              <li><strong>Brevo</strong> — sends transactional emails (such as verification codes and notifications).</li>
              <li><strong>Firebase Cloud Messaging</strong> — delivers push notifications to your device, where enabled.</li>
              <li><strong>WhatsApp Business API</strong> — used for optional WhatsApp-based sharing/notifications, where enabled.</li>
              <li><strong>Razorpay and Stripe</strong> — process payments for premium plans and listing boosts, where enabled.</li>
              <li><strong>OpenStreetMap (Nominatim)</strong> — converts listing addresses into map coordinates.</li>
            </ul>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>4. Data Security</h2>
            <p style={bodyTextStyle}>
              We use industry-standard measures to protect your information, including password hashing,
              authenticated API access, and rate limiting on sensitive endpoints. No method of transmission
              or storage is completely secure, and we cannot guarantee absolute security of your
              information.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>5. Data Retention and Your Rights</h2>
            <p style={bodyTextStyle}>
              We retain account and listing information for as long as your account is active, and as
              needed to provide the Service. Specific retention periods for each data category are
              [DATA RETENTION PERIOD TO BE CONFIRMED]. You may request deletion of your account and
              associated personal data at any time by contacting us using the details on our{" "}
              <Link to="/contact">Contact page</Link>. We will process deletion requests in line with
              applicable law, subject to any records we're required to retain (for example, for fraud
              prevention or legal compliance).
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>6. Contact Us</h2>
            <p style={bodyTextStyle}>
              If you have questions about this Privacy Policy or how your information is handled, please
              reach out via our <Link to="/contact">Contact / Support page</Link>.
            </p>
          </section>

          <section>
            <h2 style={sectionHeadingStyle}>7. Changes to This Policy</h2>
            <p style={bodyTextStyle}>
              We may update this Privacy Policy from time to time. Material changes will be reflected by
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
