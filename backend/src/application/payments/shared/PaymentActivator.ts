import { IListingBoostRepository } from "@/domain/repositories/IListingBoostRepository";
import { IUserSubscriptionRepository } from "@/domain/repositories/IUserSubscriptionRepository";
import { IPremiumPlanRepository } from "@/domain/repositories/IPremiumPlanRepository";
import { PaymentPricingConfig } from "@/application/dtos/PaymentPricingConfig";
import { IClock } from "@/domain/services/IClock";
import { PurchasableType } from "@/domain/entities/PaymentOrder";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns a confirmed payment into the thing the user actually paid for --
 * an active listing boost/featured slot, or an active premium
 * subscription. Shared by both webhook handlers (Razorpay and Stripe)
 * since "what happens after a successful payment" doesn't depend on which
 * gateway confirmed it.
 */
export class PaymentActivator {
  constructor(
    private readonly listingBoostRepo: IListingBoostRepository,
    private readonly userSubscriptionRepo: IUserSubscriptionRepository,
    private readonly premiumPlanRepo: IPremiumPlanRepository,
    private readonly pricing: PaymentPricingConfig,
    private readonly clock: IClock,
  ) {}

  async activate(purchasableType: PurchasableType, purchasableId: string): Promise<void> {
    const now = this.clock.now();

    if (purchasableType === "listing_boost") {
      const boost = await this.listingBoostRepo.findById(purchasableId);
      if (!boost) throw new Error(`listing_boost ${purchasableId} not found during activation`);

      const durationDays =
        boost.boostType === "featured"
          ? this.pricing.featuredListingDurationDays
          : this.pricing.boostListingDurationDays;

      await this.listingBoostRepo.activate(
        purchasableId,
        now,
        new Date(now.getTime() + durationDays * DAY_MS),
      );
      return;
    }

    const subscription = await this.userSubscriptionRepo.findById(purchasableId);
    if (!subscription) throw new Error(`user_subscription ${purchasableId} not found during activation`);

    const plan = await this.premiumPlanRepo.findById(subscription.planId);
    if (!plan) throw new Error(`premium_plan ${subscription.planId} not found during activation`);

    await this.userSubscriptionRepo.activate(
      purchasableId,
      now,
      new Date(now.getTime() + plan.durationDays * DAY_MS),
    );
  }
}
