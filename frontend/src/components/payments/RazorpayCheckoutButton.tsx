import { useState } from "react";
import { loadScript } from "@/utils/loadScript";
import { CreateOrderResult, PaymentPublicConfig } from "@/api/types";

interface Props {
  order: CreateOrderResult;
  config: PaymentPublicConfig;
  label: string;
  onSuccess: () => void;
}

/**
 * Razorpay's checkout is a hosted modal (Checkout.js) -- once
 * order_id/amount/key are handed to it, it collects card/UPI/wallet
 * details itself and calls our `handler` with a signed payment
 * confirmation. That confirmation is a UX convenience only: the
 * authoritative "did this actually get paid" answer is the
 * signature-verified webhook (HandlePaymentWebhook.usecase.ts), not this
 * client-side callback, which is why onSuccess just triggers a refetch
 * rather than treating the purchase as confirmed on the spot.
 */
export function RazorpayCheckoutButton({ order, config, label, onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!window.Razorpay) throw new Error("Razorpay checkout failed to load");

      const instance = new window.Razorpay({
        key: config.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.gatewayOrderId,
        name: "RentIt",
        description: label,
        handler: () => onSuccess(),
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#0f766e" },
      });
      instance.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-v2 btn-v2--primary" onClick={pay} disabled={busy}>
        {busy ? "Opening checkout..." : `Pay with Razorpay`}
      </button>
      {error ? <div className="alert alert--error" style={{ marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
