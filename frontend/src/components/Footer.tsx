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
      { label: "About RentIt", href: "/" },
      { label: "Careers", href: "/" },
      { label: "Press", href: "/" },
      { label: "Blog", href: "/" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/" },
      { label: "Contact us", href: "/" },
      { label: "Trust & safety", href: "/" },
      { label: "Sitemap", href: "/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/" },
      { label: "Privacy policy", href: "/" },
      { label: "Cookie policy", href: "/" },
    ],
  },
];

/** Premium marketplace footer -- new, shared across every public page via
 * Layout.tsx. Placeholder links (href="/") for pages that don't exist yet
 * (About/Careers/etc.) rather than 404s or dead '#' anchors, since the task
 * is a visual redesign, not authoring new legal/marketing pages. */
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
