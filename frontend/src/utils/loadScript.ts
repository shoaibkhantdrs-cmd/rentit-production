const loadedScripts = new Map<string, Promise<void>>();

/**
 * Loads a third-party script (Razorpay Checkout.js, Stripe.js) exactly
 * once per page, regardless of how many components ask for it. Used
 * instead of an npm SDK dependency for both payment gateways -- there's
 * no bundler-friendly reason to install @stripe/stripe-js or a Razorpay
 * package when both providers explicitly recommend loading their script
 * from their own CDN at runtime (so they can ship security fixes without
 * every integrator re-deploying).
 */
export function loadScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}
