import { z } from "zod";

export const startConversationSchema = z.object({
  recipientId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().max(4000).optional(),
});

export const conversationIdParamSchema = z.object({ id: z.string().uuid() });
export const messageIdParamSchema = z.object({ id: z.string().uuid(), messageId: z.string().uuid() });

export const chatPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
