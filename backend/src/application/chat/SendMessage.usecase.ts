import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IMessageRepository } from "@/domain/repositories/IMessageRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IImageStorageService } from "@/domain/services/IImageStorageService";
import { IPushNotificationService } from "@/domain/services/IPushNotificationService";
import { IRealtimeGateway } from "@/domain/services/IRealtimeGateway";
import { ValidationError } from "@/domain/errors/AppError";
import { assertParticipant } from "./shared/assertParticipant";
import { isCategoryEnabled } from "@/application/notifications/NotificationPreferences";

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  body?: string | null;
  image?: { buffer: Buffer } | null;
}

const PREVIEW_MAX_LENGTH = 120;

export class SendMessageUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly messageRepo: IMessageRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly userRepo: IUserRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly imageStorage: IImageStorageService,
    private readonly pushService: IPushNotificationService,
    private readonly realtimeGateway: IRealtimeGateway,
  ) {}

  async execute(input: SendMessageInput) {
    await assertParticipant(this.conversationRepo, input.conversationId, input.senderId);

    const trimmedBody = input.body?.trim() || null;
    if (!trimmedBody && !input.image) {
      throw new ValidationError("A message needs text, an image, or both");
    }

    let imageUrl: string | null = null;
    let imagePublicId: string | null = null;
    if (input.image) {
      const uploaded = await this.imageStorage.upload({
        buffer: input.image.buffer,
        folder: `chat/${input.conversationId}`,
      });
      imageUrl = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    const message = await this.messageRepo.create({
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: trimmedBody,
      imageUrl,
      imagePublicId,
    });

    const preview = trimmedBody
      ? trimmedBody.slice(0, PREVIEW_MAX_LENGTH)
      : "Sent a photo";
    await this.conversationRepo.touchLastMessage(input.conversationId, preview, message.createdAt);

    const participantIds = await this.conversationRepo.listParticipantIds(input.conversationId);
    const recipientIds = participantIds.filter((id) => id !== input.senderId);

    this.realtimeGateway.publishToConversation(input.conversationId, recipientIds, {
      type: "message.new",
      conversationId: input.conversationId,
      message,
    });

    const sender = await this.userRepo.findById(input.senderId);
    const senderName = sender?.name ?? "Someone";
    await Promise.all(
      recipientIds.map(async (recipientId) => {
        await this.notificationRepo.create({
          userId: recipientId,
          type: "chat_message",
          title: `New message from ${senderName}`,
          body: preview,
          data: { conversationId: input.conversationId, messageId: message.id },
        });
        const wantsPush = await isCategoryEnabled(
          this.userPreferenceRepo,
          recipientId,
          "newMessages",
        );
        if (wantsPush) {
          await this.pushService.send({
            userId: recipientId,
            title: `New message from ${senderName}`,
            body: preview,
            data: { conversationId: input.conversationId },
          });
        }
      }),
    );

    return message;
  }
}
