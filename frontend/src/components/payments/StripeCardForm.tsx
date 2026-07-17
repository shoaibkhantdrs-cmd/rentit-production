import { useEffect, useRef, useState } from "react";
import { loadScript } from "@/utils/loadScript";
import { CreateOrderResult, PaymentPublicConfig } from "@/api/types";

interface Props {
  order: CreateOrderResult;
  config: PaymentPublicConfig;
  onSuccess: () => void;
}

/**
 * Unlike Razorpay's hosted modal, Stripe's PaymentIntent flow needs a
 * card element mounted in our own page -- confirmCardPayment() is what
 * actually charges the card, using the clientSecret CreatePremiumPlanOrder
 * /CreateListingBoostOrder returned in order.providerData. As with
 * Razorpay, this client-side "succeeded" is a UX signal only; the
 * signature-verified Stripe webhook is the source of truth that flips the
 * purchase to active.
 */
export function StripeCardForm({ order, config, onSuccess }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<StripeClient | null>(null);
  const elementRef = useRef<StripeCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript("https://js.stripe.com/v3/").then(() => {
      if (cancelled || !window.Stripe || !cardRef.current) return;
      const stripe = window.Stripe(config.stripePublishableKey);
      const elements = stripe.elements();
      const card = elements.create("card");
      card.mount(cardRef.current);
      card.on("change", (event) => setError(event.error?.message ?? null));
      stripeRef.current = stripe;
      elementRef.current = card;
      setReady(true);
    });
    return () => {
      cancelled = true;
      elementRef.current?.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientSecret = order.providerData?.clientSecret as string | undefined;

  const pay = async () => {
    const stripe = stripeRef.current;
    const card = elementRef.current;
    if (!stripe || !card || !clientSecret) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.paymentIntent?.status === "succeeded") onSuccess();
  };

  if (!clientSecret) {
    return <div className="alert alert--error">This order wasn't created for Stripe.</div>;
  }

  return (
    <div>
      <div ref={cardRef} className="stripe-card-element" style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }} />
      {error ? <div className="alert alert--error" style={{ marginTop: 8 }}>{error}</div> : null}
      <button type="button" className="btn-v2 btn-v2--primary" style={{ marginTop: 12 }} onClick={pay} disabled={!ready || busy}>
        {busy ? "Processing..." : "Pay with card"}
      </button>
    </div>
  );
}
