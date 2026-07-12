import { ApprovePropertyUseCase } from "./ApproveProperty.usecase";
import { RejectPropertyUseCase } from "./RejectProperty.usecase";
import { HidePropertyUseCase } from "./HideProperty.usecase";
import { UnhidePropertyUseCase } from "./UnhideProperty.usecase";
import { FeaturePropertyUseCase } from "./FeatureProperty.usecase";
import { UnfeaturePropertyUseCase } from "./UnfeatureProperty.usecase";
import { DeletePropertyUseCase } from "@/application/properties/DeleteProperty.usecase";
import { ValidationError } from "@/domain/errors/AppError";

export type BulkModerationAction = "approve" | "reject" | "hide" | "unhide" | "feature" | "unfeature" | "delete";

export interface BulkModeratePropertiesInput {
  propertyIds: string[];
  action: BulkModerationAction;
  actorId: string;
  actorRoles: string[];
  reason?: string;
}

export interface BulkModerationResultItem {
  propertyId: string;
  success: boolean;
  error?: string;
}

/**
 * "Bulk Actions" (Part 3): applies one moderation action to many
 * properties, running each one through the exact same single-item
 * use-case as the non-bulk endpoints (so bulk and single-item moderation
 * can never drift in behavior). Partial-failure tolerant -- one bad ID in
 * a batch of 50 doesn't roll back the other 49.
 */
export class BulkModeratePropertiesUseCase {
  constructor(
    private readonly approveProperty: ApprovePropertyUseCase,
    private readonly rejectProperty: RejectPropertyUseCase,
    private readonly hideProperty: HidePropertyUseCase,
    private readonly unhideProperty: UnhidePropertyUseCase,
    private readonly featureProperty: FeaturePropertyUseCase,
    private readonly unfeatureProperty: UnfeaturePropertyUseCase,
    private readonly deleteProperty: DeletePropertyUseCase,
  ) {}

  async execute(input: BulkModeratePropertiesInput): Promise<{ results: BulkModerationResultItem[] }> {
    if (input.propertyIds.length === 0) {
      throw new ValidationError("propertyIds must not be empty");
    }
    if (input.propertyIds.length > 100) {
      throw new ValidationError("A single bulk action is limited to 100 properties");
    }
    if (input.action === "reject" && !input.reason?.trim()) {
      throw new ValidationError("A rejection reason is required for bulk reject");
    }

    const results: BulkModerationResultItem[] = [];

    for (const propertyId of input.propertyIds) {
      try {
        await this.runOne(propertyId, input);
        results.push({ propertyId, success: true });
      } catch (err) {
        results.push({
          propertyId,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { results };
  }

  private async runOne(propertyId: string, input: BulkModeratePropertiesInput): Promise<void> {
    switch (input.action) {
      case "approve":
        await this.approveProperty.execute({ propertyId, actorId: input.actorId });
        return;
      case "reject":
        await this.rejectProperty.execute({ propertyId, actorId: input.actorId, reason: input.reason as string });
        return;
      case "hide":
        await this.hideProperty.execute({ propertyId, actorId: input.actorId, reason: input.reason });
        return;
      case "unhide":
        await this.unhideProperty.execute({ propertyId, actorId: input.actorId });
        return;
      case "feature":
        await this.featureProperty.execute({ propertyId, actorId: input.actorId });
        return;
      case "unfeature":
        await this.unfeatureProperty.execute({ propertyId, actorId: input.actorId });
        return;
      case "delete":
        await this.deleteProperty.execute({
          propertyId,
          requesterId: input.actorId,
          requesterRoles: input.actorRoles,
        });
        return;
      default: {
        const _exhaustive: never = input.action;
        throw new ValidationError(`Unknown bulk action: ${_exhaustive}`);
      }
    }
  }
}
