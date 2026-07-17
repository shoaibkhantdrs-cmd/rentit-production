import { httpClient } from "./httpClient";
import {
  BoostType,
  CreateOrderResult,
  InvoiceRecord,
  PaginatedResult,
  PaymentGatewayName,
  PaymentPublicConfig,
  PaymentRecord,
  PremiumPlan,
} from "./types";

export const paymentsApi = {
  // Public config (gateway public keys) is safe to cache for a while --
  // it only changes on a deploy. Same cacheMs pattern httpClient already
  // uses for property categories.
  config: () => httpClient.get<PaymentPublicConfig>("/payments/config", undefined, false, 5 * 60_000),

  plans: () => httpClient.get<{ items: PremiumPlan[] }>("/payments/plans", undefined, false, 60_000),

  createListingBoostOrder: (propertyId: string, boostType: BoostType, gateway: PaymentGatewayName) =>
    httpClient.post<CreateOrderResult>("/payments/listing-boosts", { propertyId, boostType, gateway }),

  createPremiumPlanOrder: (planId: string, gateway: PaymentGatewayName) =>
    httpClient.post<CreateOrderResult>("/payments/subscriptions", { planId, gateway }),

  history: (page = 1, pageSize = 20) =>
    httpClient.get<PaginatedResult<PaymentRecord>>("/payments/history", { page, pageSize }),

  invoices: (page = 1, pageSize = 20) =>
    httpClient.get<PaginatedResult<InvoiceRecord>>("/payments/invoices", { page, pageSize }),

  invoice: (id: string) => httpClient.get<InvoiceRecord>(`/payments/invoices/${id}`),
};
