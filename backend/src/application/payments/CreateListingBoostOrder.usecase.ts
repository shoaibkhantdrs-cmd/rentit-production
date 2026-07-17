import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IListingBoostRepository } from "@/domain/repositories/IListingBoostRepository";
import { IPaymentOrderRepository } from "@/domain/repositories/IPaymentOrderRepository";
import { IPaymentGateway } from "@/domain/services/IPaymentGateway";
import { PaymentPricingConfig } from "@/application/dtos/PaymentPricingConfig";
import { BoostType } from "@/domain/entities/ListingBoost";
import { PaymentGateway as GatewayName } from "@/domain/entities/PaymentOrder";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface CreateListingBoostOrderInput {
  userId: string;
  propertyId: string;
  boostType: BoostType;
  gateway: GatewayName;
}

export interface CreateListingBoostOrderResult {
  paymentOrderId: string;
  gateway: GatewayName;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  providerData?: Record<string, unknown>;
}

export class CreateListingBoostOrderUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly listingBoostRepo: IListingBoostRepository,
    private readonly paymentOrderRepo: IPaymentOrderRepository,
    private readonly gateways: Record<GatewayName, IPaymentGateway>,
    private readonly pricing: PaymentPricingConfig,
  ) {}

  async execute(input: CreateListingBoostOrderInput): Promise<CreateListingBoostOrderResult> {
    if (input.boostType !== "featured" && input.boostType !== "boost") {
      throw new ValidationError("boostType must be 'featured' or 'boost'");
    }

    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property) throw new NotFoundError("Property not found");
    if (property.ownerId !== input.userId) {
      throw new ForbiddenError("You can only boost your own listings");
    }

    const amount =
      input.boostType === "featured"
        ? this.pricing.featuredListingPriceAmount
        : this.pricing.boostListingPriceAmount;

    const boost = await this.listingBoostRepo.create({
      propertyId: input.propertyId,
      userId: input.userId,
      boostType: input.boostType,
    });

    const gateway = this.gateways[input.gateway];
    const gatewayOrder = await gateway.createOrder({
      amount,
      currency: this.pricing.currency,
      receipt: boost.id,
      notes: { purpose: "listing_boost", propertyId: input.propertyId, boostType: input.boostType },
    });

    const paymentOrder = await this.paymentOrderRepo.create({
      userId: input.userId,
      gateway: input.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      purpose: "listing_boost",
      purchasableType: "listing_boost",
      purchasableId: boost.id,
      amount,
      currency: this.pricing.currency,
    });

    return {
      paymentOrderId: paymentOrder.id,
      gateway: input.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      amount,
      currency: this.pricing.currency,
      providerData: gatewayOrder.providerData,
    };
  }
}
