import { Download, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/** Surfaces the real native install prompt (see usePwaInstall) as a slim,
 * dismissible banner -- same visual weight as OfflineBanner so the two
 * never fight for attention if both are somehow true at once. */
export function PwaInstallBanner() {
  const { installable, promptInstall, dismiss } = usePwaInstall();
  if (!installable) return null;

  return (
    <div className="pwa-install-banner" role="status">
      <Download size={16} />
      <span>Install RentIt for a faster, app-like experience.</span>
      <button type="button" className="pwa-install-banner__install" onClick={promptInstall}>
        Install
      </button>
      <button type="button" className="pwa-install-banner__dismiss" aria-label="Dismiss" onClick={dismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
