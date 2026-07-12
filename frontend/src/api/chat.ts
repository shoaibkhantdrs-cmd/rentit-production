import { httpClient } from "./httpClient";
import { ConversationSummary, MessageDto, PaginatedResult, RawMessageEvent } from "./types";

export const chatApi = {
  unreadCount: () => httpClient.get<{ unreadCount: number }>("/chat/unread-count"),

  listConversations: (page = 1, pageSize = 30) =>
    httpClient.get<PaginatedResult<ConversationSummary>>("/chat/conversations", { page, pageSize }),

  startConversation: (recipientId: string, propertyId?: string) =>
    httpClient.post<{ id: string; propertyId: string | null }>("/chat/conversations", {
      recipientId,
      propertyId,
    }),

  listMessages: (conversationId: string, page = 1, pageSize = 50) =>
    httpClient.get<PaginatedResult<MessageDto>>(`/chat/conversations/${conversationId}/messages`, {
      page,
      pageSize,
    }),

  // The backend returns the raw Message entity here (see
  // SendMessage.usecase.ts), not a MessageDto -- there's no "other
  // participant" to compute isMine/readByOther against yet since this
  // *is* that message being created. Callers convert it themselves.
  sendMessage: (conversationId: string, body: string | null, image?: File | null) => {
    const form = new FormData();
    if (body) form.append("body", body);
    if (image) form.append("image", image);
    return httpClient.postForm<RawMessageEvent>(`/chat/conversations/${conversationId}/messages`, form);
  },

  markRead: (conversationId: string) =>
    httpClient.post<void>(`/chat/conversations/${conversationId}/read`),

  deleteMessage: (conversationId: string, messageId: string) =>
    httpClient.delete<void>(`/chat/conversations/${conversationId}/messages/${messageId}`),
};
