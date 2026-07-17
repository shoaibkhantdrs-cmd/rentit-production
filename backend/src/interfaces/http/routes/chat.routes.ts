import { RequestHandler, Router } from "express";
import { ChatController } from "@/interfaces/http/controllers/ChatController";
import { asyncHandler } from "@/interfaces/http/asyncHandler";
import { validate } from "@/interfaces/http/middleware/validate";
import { uploadSingleImage } from "@/interfaces/http/middleware/imageUpload";
import {
  startConversationSchema,
  sendMessageSchema,
  conversationIdParamSchema,
  messageIdParamSchema,
  chatPaginationQuerySchema,
} from "@/interfaces/http/validators/chat.schemas";

export function createChatRouter(
  controller: ChatController,
  authenticate: RequestHandler,
  messagingRateLimiter: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/unread-count", asyncHandler(controller.unreadCount));

  router.get(
    "/conversations",
    validate(chatPaginationQuerySchema, "query"),
    asyncHandler(controller.list),
  );
  router.post("/conversations", validate(startConversationSchema), asyncHandler(controller.start));

  router.get(
    "/conversations/:id/messages",
    validate(conversationIdParamSchema, "params"),
    validate(chatPaginationQuerySchema, "query"),
    asyncHandler(controller.listMessagesForConversation),
  );
  router.post(
    "/conversations/:id/messages",
    // Audit fix: sending messages had no rate limit -- capped now so a
    // compromised/malicious account can't flood a conversation or the
    // downstream push/email notification pipeline.
    messagingRateLimiter,
    validate(conversationIdParamSchema, "params"),
    uploadSingleImage("image"),
    validate(sendMessageSchema),
    asyncHandler(controller.postMessage),
  );
  router.post(
    "/conversations/:id/read",
    validate(conversationIdParamSchema, "params"),
    asyncHandler(controller.markRead),
  );
  router.delete(
    "/conversations/:id/messages/:messageId",
    validate(messageIdParamSchema, "params"),
    asyncHandler(controller.removeMessage),
  );

  return router;
}
