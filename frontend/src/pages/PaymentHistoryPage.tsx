import { paymentsApi } from "@/api/payments";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
}

const STATUS_LABELS: Record<string, string> = {
  succeeded: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

function PaymentHistoryList() {
  const { status, data, error, reload } = useAsync(() => paymentsApi.history(), []);
  const invoices = useAsync(() => paymentsApi.invoices(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payment history</h1>
          <p>Every payment you've made for boosts, featured listings, and premium plans.</p>
        </div>
      </div>

      {status === "loading" && <div className="skeleton skeleton--title" style={{ width: "60%" }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && data.items.length === 0 && (
        <EmptyState icon="🧾" title="No payments yet" description="Purchases you make will show up here." />
      )}
      {status === "success" && data.items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((payment) => (
              <tr key={payment.id}>
                <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                <td>{formatAmount(payment.amount, payment.currency)}</td>
                <td>{payment.method ?? "—"}</td>
                <td>{STATUS_LABELS[payment.status] ?? payment.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 32 }}>Invoices</h2>
      {/* Bug fix (QA report #10): this section used to only handle
          status === "success" -- while loading it showed nothing (no
          skeleton, unlike the payments table above), and on error it
          rendered completely blank with no message and no retry. */}
      {invoices.status === "loading" && <div className="skeleton skeleton--title" style={{ width: "60%" }} />}
      {invoices.status === "error" && <ErrorState message={invoices.error} onRetry={invoices.reload} />}
      {invoices.status === "success" && invoices.data.items.length === 0 && (
        <EmptyState icon="📄" title="No invoices yet" />
      )}
      {invoices.status === "success" && invoices.data.items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Issued</th>
            </tr>
          </thead>
          <tbody>
            {invoices.data.items.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.lineDescription}</td>
                <td>{formatAmount(invoice.amount, invoice.currency)}</td>
                <td>{new Date(invoice.issuedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function PaymentHistoryPage() {
  return (
    <RequireAuth message="Sign in to see your payment history.">
      <PaymentHistoryList />
    </RequireAuth>
  );
}
