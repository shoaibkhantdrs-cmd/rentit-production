import { useState } from "react";
import { paymentsApi } from "@/api/payments";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { CreateOrderResult, PaymentGatewayName, PremiumPlan } from "@/api/types";
import { RazorpayCheckoutButton } from "@/components/payments/RazorpayCheckoutButton";
import { StripeCardForm } from "@/components/payments/StripeCardForm";

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
}

function PlanCard({ plan }: { plan: PremiumPlan }) {
  const [gateway, setGateway] = useState<PaymentGatewayName>("razorpay");
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof paymentsApi.config>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const [orderResult, configResult] = await Promise.all([
        paymentsApi.createPremiumPlanOrder(plan.id, gateway),
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
        <h3>{plan.name}</h3>
        <p>Payment received. Your plan will activate as soon as the gateway confirms it (usually within seconds).</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{plan.name}</h3>
      <p className="field-hint">{plan.description}</p>
      <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        {formatAmount(plan.priceAmount, plan.currency)}
        <span className="field-hint" style={{ fontSize: "0.9rem" }}> / {plan.durationDays} days</span>
      </p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      {!order && (
        <>
          <div className="form-row">
            <label>
              <input
                type="radio"
                name={`gateway-${plan.id}`}
                checked={gateway === "razorpay"}
                onChange={() => setGateway("razorpay")}
              />
              Razorpay (cards, UPI, wallets)
            </label>
            <label>
              <input
                type="radio"
                name={`gateway-${plan.id}`}
                checked={gateway === "stripe"}
                onChange={() => setGateway("stripe")}
              />
              Stripe (international cards)
            </label>
          </div>
          <button type="button" className="btn-v2 btn-v2--primary" onClick={startCheckout} disabled={busy}>
            {busy ? "Starting checkout..." : "Subscribe"}
          </button>
          {error ? <div className="alert alert--error" style={{ marginTop: 8 }}>{error}</div> : null}
        </>
      )}

      {order && config && gateway === "razorpay" && (
        <RazorpayCheckoutButton order={order} config={config} label={plan.name} onSuccess={() => setPurchased(true)} />
      )}
      {order && config && gateway === "stripe" && (
        <StripeCardForm order={order} config={config} onSuccess={() => setPurchased(true)} />
      )}
    </div>
  );
}

function PremiumPlansList() {
  const { status, data, error, reload } = useAsync(() => paymentsApi.plans(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Premium plans</h1>
          <p>Get more visibility for your listings with a premium subscription.</p>
        </div>
      </div>

      {status === "loading" && <div className="skeleton skeleton--title" style={{ width: "60%" }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && (
        <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {data.items.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PremiumPlansPage() {
  return (
    <RequireAuth message="Sign in to subscribe to a premium plan.">
      <PremiumPlansList />
    </RequireAuth>
  );
}
