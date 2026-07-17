import { useCallback, useEffect, useState } from "react";

const DISMISSED_KEY = "rentit.pwaInstallDismissed";

/** Minimal shape of the real `beforeinstallprompt` event -- not in
 * lib.dom.d.ts yet, so it's typed locally rather than widened to `any`. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Wraps the real `beforeinstallprompt` browser event -- the manifest and
 * service worker (`public/manifest.webmanifest`, `public/sw.js`) already
 * make this app genuinely installable; nothing here was fabricated, this
 * just surfaces the native prompt instead of leaving it silently
 * available only via the browser's own menu. Chromium-based browsers
 * only (Safari/Firefox never fire this event, so `installable` stays
 * false there and no broken button is shown).
 */
export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }, [deferredEvent]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private browsing -- the banner will just reappear next visit, harmless.
    }
  }, []);

  return {
    installable: deferredEvent !== null && !installed && !dismissed,
    promptInstall,
    dismiss,
  };
}
