import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";

/**
 * Every chat use-case below needs the same check -- "does this
 * conversation exist, and is the requester actually part of it" -- so it
 * lives in one place rather than being re-typed (and possibly
 * re-typed-wrong) in six different use-cases.
 */
export async function assertParticipant(
  conversationRepo: IConversationRepository,
  conversationId: string,
  userId: string,
): Promise<void> {
  const conversation = await conversationRepo.findById(conversationId);
  if (!conversation || conversation.deletedAt) {
    throw new NotFoundError("Conversation not found");
  }
  const isParticipant = await conversationRepo.isParticipant(conversationId, userId);
  if (!isParticipant) {
    throw new ForbiddenError("You are not part of this conversation");
  }
}
