import { Request, Response } from "express";
import { z } from "zod";
import { StartConversationUseCase } from "@/application/chat/StartConversation.usecase";
import { SendMessageUseCase } from "@/application/chat/SendMessage.usecase";
import { ListConversationsUseCase } from "@/application/chat/ListConversations.usecase";
import { ListMessagesUseCase } from "@/application/chat/ListMessages.usecase";
import { MarkConversationReadUseCase } from "@/application/chat/MarkConversationRead.usecase";
import { DeleteMessageUseCase } from "@/application/chat/DeleteMessage.usecase";
import { GetUnreadMessageCountUseCase } from "@/application/chat/GetUnreadMessageCount.usecase";
import { UnauthorizedError, ValidationError } from "@/domain/errors/AppError";
import {
  startConversationSchema,
  sendMessageSchema,
  chatPaginationQuerySchema,
} from "@/interfaces/http/validators/chat.schemas";

export class ChatController {
  constructor(
    private readonly startConversation: StartConversationUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly listConversations: ListConversationsUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly markConversationRead: MarkConversationReadUseCase,
    private readonly deleteMessage: DeleteMessageUseCase,
    private readonly getUnreadMessageCount: GetUnreadMessageCountUseCase,
  ) {}

  start = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof startConversationSchema>;
    const result = await this.startConversation.execute({
      initiatorId: req.user.sub,
      recipientId: body.recipientId,
      propertyId: body.propertyId ?? null,
    });
    res.status(201).json(result);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof chatPaginationQuerySchema>;
    const result = await this.listConversations.execute({
      userId: req.user.sub,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  unreadCount = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.getUnreadMessageCount.execute(req.user.sub);
    res.status(200).json(result);
  };

  listMessagesForConversation = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof chatPaginationQuerySchema>;
    const result = await this.listMessages.execute({
      conversationId: req.params.id,
      requesterId: req.user.sub,
      page: query.page,
      pageSize: query.pageSize,
    });
    res.status(200).json(result);
  };

  postMessage = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof sendMessageSchema>;
    const file = req.file as Express.Multer.File | undefined;
    if (!body.body && !file) {
      throw new ValidationError("A message needs text, an image, or both");
    }
    const result = await this.sendMessage.execute({
      conversationId: req.params.id,
      senderId: req.user.sub,
      body: body.body ?? null,
      image: file ? { buffer: file.buffer } : null,
    });
    res.status(201).json(result);
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.markConversationRead.execute({ conversationId: req.params.id, userId: req.user.sub });
    res.status(204).send();
  };

  removeMessage = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.deleteMessage.execute({
      conversationId: req.params.id,
      messageId: req.params.messageId,
      requesterId: req.user.sub,
    });
    res.status(204).send();
  };
}
