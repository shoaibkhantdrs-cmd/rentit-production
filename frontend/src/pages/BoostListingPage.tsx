import { useState } from "react";
import { useParams } from "react-router-dom";
import { paymentsApi } from "@/api/payments";
import { RequireAuth } from "@/components/RequireAuth";
import { ApiError } from "@/api/httpClient";
import { BoostType, CreateOrderResult, PaymentGatewayName, PaymentPublicConfig } from "@/api/types";
import { RazorpayCheckoutButton } from "@/components/payments/RazorpayCheckoutButton";
import { StripeCardForm } from "@/components/payments/StripeCardForm";

const BOOST_OPTIONS: { type: BoostType; title: string; description: string }[] = [
  {
    type: "featured",
    title: "Featured listing",
    description: "Appears in the Featured section on the homepage and search results.",
  },
  {
    type: "boost",
    title: "Boost listing",
    description: "Bumped higher in ordinary search results for a limited time.",
  },
];

function BoostListingForm({ propertyId }: { propertyId: string }) {
  const [boostType, setBoostType] = useState<BoostType>("featured");
  const [gateway, setGateway] = useState<PaymentGatewayName>("razorpay");
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [config, setConfig] = useState<PaymentPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const [orderResult, configResult] = await Promise.all([
        paymentsApi.createListingBoostOrder(propertyId, boostType, gateway),
        paymentsApi.config(),
      ]);
      setOrder(orderResult);
      setConfig(configResult);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  };

  if (purchased) {
    return (
      <div className="card">
        <h2>Payment received</h2>
        <p>Your listing will be boosted as soon as the gateway confirms the payment (usually within seconds).</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Boost this listing</h1>

      {!order && (
        <>
          <fieldset style={{ border: "none", padding: 0 }}>
            <legend className="field-hint">Choose a boost type</legend>
            {BOOST_OPTIONS.map((option) => (
              <label key={option.type} style={{ display: "block", marginBottom: 8 }}>
                <input
                  type="radio"
                  name="boostType"
                  checked={boostType === option.type}
                  onChange={() => setBoostType(option.type)}
                />
                {" "}
                <strong>{option.title}</strong> — {option.description}
              </label>
            ))}
          </fieldset>

          <div className="form-row" style={{ marginTop: 16 }}>
            <label>
              <input
                type="radio"
                name="gateway"
                checked={gateway === "razorpay"}
                onChange={() => setGateway("razorpay")}
              />
              Razorpay
            </label>
            <label>
              <input type="radio" name="gateway" checked={gateway === "stripe"} onChange={() => setGateway("stripe")} />
              Stripe
            </label>
          </div>

          <button type="button" className="btn-v2 btn-v2--primary" style={{ marginTop: 16 }} onClick={startCheckout} disabled={busy}>
            {busy ? "Starting checkout..." : "Continue to payment"}
          </button>
          {error ? <div className="alert alert--error" style={{ marginTop: 8 }}>{error}</div> : null}
        </>
      )}

      {order && config && gateway === "razorpay" && (
        <RazorpayCheckoutButton
          order={order}
          config={config}
          label={BOOST_OPTIONS.find((o) => o.type === boostType)?.title ?? "Listing boost"}
          onSuccess={() => setPurchased(true)}
        />
      )}
      {order && config && gateway === "stripe" && (
        <StripeCardForm order={order} config={config} onSuccess={() => setPurchased(true)} />
      )}
    </div>
  );
}

export function BoostListingPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <RequireAuth message="Sign in to boost your listing.">
      {id ? <BoostListingForm propertyId={id} /> : null}
    </RequireAuth>
  );
}
