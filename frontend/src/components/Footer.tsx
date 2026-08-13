import { Building2, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Search properties", href: "/search" },
      { label: "List a property", href: "/properties/new" },
      { label: "Premium plans", href: "/premium-plans" },
      { label: "Favorites", href: "/favorites" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About RentIt", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/" },
      { label: "Contact us", href: "/contact" },
      { label: "Trust & safety", href: "/" },
      { label: "Sitemap", href: "/sitemap.xml" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Cookie policy", href: "/cookie-policy" },
    ],
  },
];

/** Premium marketplace footer -- new, shared across every public page via
 * Layout.tsx. Pre-launch footer-links audit: the COMPANY column (About/
 * Careers/Press/Blog) previously all pointed at href="/" as placeholders --
 * now real pages (see App.tsx routes: /about, /careers, /press, /blog).
 * Help center / Trust & safety under Support remain placeholder href="/"
 * since they're out of scope for this audit (only the COMPANY column was
 * requested). Terms of service, Privacy policy, and Cookie policy are real
 * pages (see App.tsx routes) because legal/compliance pages were
 * prioritized ahead of a public launch. Sitemap likewise points to a real,
 * static /sitemap.xml (see frontend/public) rather than a React route --
 * it's a machine-readable resource for search engines, not a page a person
 * browses to. */
export function Footer() {
  return (
    <footer className="footer-v2">
      <div className="footer-v2__grid">
        <div>
          <div className="footer-v2__brand">
            <Building2 size={20} style={{ verticalAlign: "-4px", marginRight: 6 }} />
            RentIt
          </div>
          <p className="footer-v2__tagline">
            The premium way to find, list, and manage rental homes -- verified listings, direct owner
            contact, no middlemen.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="footer-v2__col-title">{col.title}</div>
            <ul className="footer-v2__links">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer-v2__bottom">
        <span>&copy; {new Date().getFullYear()} RentIt. All rights reserved.</span>
        <div className="footer-v2__social">
          <a href="/" aria-label="RentIt on Facebook">
            <Facebook size={16} />
          </a>
          <a href="/" aria-label="RentIt on Instagram">
            <Instagram size={16} />
          </a>
          <a href="/" aria-label="RentIt on X (Twitter)">
            <Twitter size={16} />
          </a>
          <a href="/" aria-label="RentIt on LinkedIn">
            <Linkedin size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}
