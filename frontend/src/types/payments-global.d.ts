// Minimal ambient types for the two gateway SDKs, loaded at runtime via
// loadScript() rather than installed as npm packages (see
// utils/loadScript.ts's doc comment). Only the handful of members this
// app actually calls are declared -- not a full SDK type definition.

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

interface RazorpayCheckoutInstance {
  open(): void;
}

interface Window {
  Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  Stripe?: (publishableKey: string) => StripeClient;
}

interface StripeCardElement {
  mount(selector: string | HTMLElement): void;
  unmount(): void;
  on(event: "change", handler: (event: { error?: { message: string } }) => void): void;
}

interface StripeElements {
  create(type: "card"): StripeCardElement;
}

interface StripeClient {
  elements(): StripeElements;
  confirmCardPayment(
    clientSecret: string,
    data: { payment_method: { card: StripeCardElement } },
  ): Promise<{ error?: { message: string }; paymentIntent?: { status: string } }>;
}
