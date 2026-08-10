import { useEffect } from "react";

/**
 * Every route currently renders under the single static <title>RentIt</title>
 * set in index.html -- there is no per-page title anywhere in the app (grep
 * for document.title/react-helmet across frontend/src turns up nothing).
 * That means every browser tab, bookmark, and search-engine result snippet
 * looks identical regardless of which page you're on, and shared links
 * (this app has an explicit WhatsApp share feature -- see
 * RazorpayCheckoutButton's sibling components and WhatsApp Business API
 * usage) preview with a generic, undifferentiated title.
 *
 * This is the minimal fix: a plain useEffect, no new dependency (no
 * react-helmet-async), matching the lightweight-hook convention already
 * used by useOnlineStatus/usePwaInstall/etc. in this same directory. Pass
 * just the page-specific part; "RentIt" is appended once here so every
 * call site doesn't have to repeat it or risk getting the separator wrong.
 */
export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | RentIt` : "RentIt";
  }, [pageTitle]);
}
