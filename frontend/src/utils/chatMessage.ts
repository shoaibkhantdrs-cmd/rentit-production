import { MessageDto, RawMessageEvent } from "@/api/types";

/** Converts the raw Message entity the backend hands back from both
 * SendMessageUseCase's HTTP response and the "message.new" WebSocket event
 * into the same MessageDto shape ListMessagesUseCase returns for the
 * initial page load, so the thread page can treat every message
 * uniformly regardless of where it came from. */
export function toMessageDto(raw: RawMessageEvent, currentUserId: string): MessageDto {
  const isDeleted = raw.deletedAt !== null;
  return {
    id: raw.id,
    senderId: raw.senderId,
    body: isDeleted ? null : raw.body,
    imageUrl: isDeleted ? null : raw.imageUrl,
    createdAt: raw.createdAt,
    isMine: raw.senderId === currentUserId,
    isDeleted,
    readByOther: false,
  };
}
