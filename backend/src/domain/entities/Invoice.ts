export interface Invoice {
  id: string;
  paymentId: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  lineDescription: string;
  issuedAt: Date;
  createdAt: Date;
}
